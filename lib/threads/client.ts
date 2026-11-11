import "server-only";

/**
 * Threads Graph API 클라이언트.
 * 공식 문서(2026-11 확인): 도메인은 threads.com / graph.threads.com, 버전 v1.0
 */
export const THREADS_AUTH_URL = "https://threads.com/oauth/authorize";
export const THREADS_GRAPH = "https://graph.threads.com";
export const THREADS_API = `${THREADS_GRAPH}/v1.0`;

export const THREADS_SCOPES = [
  "threads_basic",
  "threads_content_publish",
  "threads_manage_insights",
  "threads_manage_replies",
] as const;

export class ThreadsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number,
    public readonly subcode?: number,
    public readonly type?: string,
  ) {
    super(message);
    this.name = "ThreadsApiError";
  }
  /** 토큰 만료·폐기 등 재연결이 필요한 오류 */
  get isAuthError(): boolean {
    return this.code === 190 || this.status === 401;
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

function toSearch(params: Params): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) sp.set(k, String(v));
  return sp;
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.text();
  let json: unknown;
  try {
    json = body ? JSON.parse(body) : {};
  } catch {
    throw new ThreadsApiError(`응답 해석 실패 (${res.status}): ${body.slice(0, 200)}`, res.status);
  }
  const j = json as Record<string, unknown>;
  // Graph 오류 형식 { error: { message, type, code, error_subcode } }
  if (j.error && typeof j.error === "object") {
    const e = j.error as Record<string, unknown>;
    throw new ThreadsApiError(
      String(e.error_user_msg ?? e.message ?? "알 수 없는 오류"),
      res.status,
      Number(e.code) || undefined,
      Number(e.error_subcode) || undefined,
      e.type ? String(e.type) : undefined,
    );
  }
  // OAuth 오류 형식 { error_type, code, error_message }
  if (j.error_message) {
    throw new ThreadsApiError(String(j.error_message), res.status, Number(j.code) || undefined, undefined, String(j.error_type ?? ""));
  }
  if (!res.ok) throw new ThreadsApiError(`HTTP ${res.status}`, res.status);
  return json as T;
}

async function get<T>(url: string, params: Params): Promise<T> {
  const res = await fetch(`${url}?${toSearch(params)}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  return parse<T>(res);
}

async function post<T>(url: string, params: Params): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    body: toSearch(params),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  return parse<T>(res);
}

function appCreds() {
  const appId = process.env.THREADS_APP_ID;
  const secret = process.env.THREADS_APP_SECRET;
  const redirectUri = process.env.THREADS_REDIRECT_URI;
  if (!appId || !secret || !redirectUri) {
    throw new Error("THREADS_APP_ID / THREADS_APP_SECRET / THREADS_REDIRECT_URI 환경변수를 설정하세요.");
  }
  return { appId, secret, redirectUri };
}

// ---------------------------------------------------------------- OAuth

export function buildAuthorizeUrl(state: string): string {
  const { appId, redirectUri } = appCreds();
  return `${THREADS_AUTH_URL}?${toSearch({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: THREADS_SCOPES.join(","),
    response_type: "code",
    state,
  })}`;
}

export type TokenResponse = { access_token: string; token_type: string; expires_in?: number; user_id?: number | string };

/** code → 단기 토큰(1시간) */
export function exchangeCode(code: string) {
  const { appId, secret, redirectUri } = appCreds();
  return post<TokenResponse>(`${THREADS_GRAPH}/oauth/access_token`, {
    client_id: appId,
    client_secret: secret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
}

/** 단기 토큰 → 장기 토큰(60일) */
export function exchangeLongLived(shortToken: string) {
  const { secret } = appCreds();
  return get<TokenResponse>(`${THREADS_GRAPH}/access_token`, {
    grant_type: "th_exchange_token",
    client_secret: secret,
    access_token: shortToken,
  });
}

/** 장기 토큰 갱신(발급 후 24시간 이상, 만료 전에만 가능) */
export function refreshLongLived(longToken: string) {
  return get<TokenResponse>(`${THREADS_GRAPH}/refresh_access_token`, {
    grant_type: "th_refresh_token",
    access_token: longToken,
  });
}

// ---------------------------------------------------------------- 프로필

export type ThreadsProfile = { id: string; username: string; name?: string; threads_profile_picture_url?: string };

export function getMe(token: string) {
  return get<ThreadsProfile>(`${THREADS_API}/me`, {
    fields: "id,username,name,threads_profile_picture_url",
    access_token: token,
  });
}

// ---------------------------------------------------------------- 발행

export type ContainerParams = {
  media_type: "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";
  text?: string;
  image_url?: string;
  video_url?: string;
  is_carousel_item?: boolean;
  children?: string[];
  reply_to_id?: string;
  topic_tag?: string;
  link_attachment?: string;
  is_made_with_ai?: boolean;
};

export async function createContainer(userId: string, token: string, p: ContainerParams): Promise<string> {
  const { children, ...rest } = p;
  const res = await post<{ id: string }>(`${THREADS_API}/${userId}/threads`, {
    ...rest,
    children: children?.join(","),
    access_token: token,
  });
  return res.id;
}

export type ContainerStatus = {
  id: string;
  status: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
  error_message?: string;
};

export function getContainerStatus(containerId: string, token: string) {
  return get<ContainerStatus>(`${THREADS_API}/${containerId}`, { fields: "status,error_message", access_token: token });
}

export async function publishContainer(userId: string, token: string, creationId: string): Promise<string> {
  const res = await post<{ id: string }>(`${THREADS_API}/${userId}/threads_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  return res.id;
}

export function getMedia(mediaId: string, token: string) {
  return get<{ id: string; permalink?: string; timestamp?: string }>(`${THREADS_API}/${mediaId}`, {
    fields: "id,permalink,timestamp",
    access_token: token,
  });
}

export type PublishingLimit = {
  quota_usage: number;
  config: { quota_total: number; quota_duration: number };
  reply_quota_usage?: number;
  reply_config?: { quota_total: number; quota_duration: number };
};

export async function getPublishingLimit(userId: string, token: string): Promise<PublishingLimit | null> {
  const res = await get<{ data: PublishingLimit[] }>(`${THREADS_API}/${userId}/threads_publishing_limit`, {
    fields: "quota_usage,config,reply_quota_usage,reply_config",
    access_token: token,
  });
  return res.data?.[0] ?? null;
}
