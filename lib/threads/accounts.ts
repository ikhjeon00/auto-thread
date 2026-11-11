import "server-only";
import { db } from "@/lib/db/admin";
import { decryptToken, encryptToken } from "@/lib/crypto/token";
import { notify } from "@/lib/notify";
import {
  ThreadsApiError,
  createContainer,
  getContainerStatus,
  getMe,
  getMedia,
  getPublishingLimit,
  publishContainer,
  refreshLongLived,
  type TokenResponse,
} from "./client";
import { THREADS_TEXT_LIMIT, countThreadsChars } from "./text";

export const MAX_ACCOUNTS = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AccountRow = {
  id: string;
  threads_user_id: string;
  username: string;
  access_token_enc: string | null;
  token_expires_at: string | null;
  token_refreshed_at: string | null;
  status: "active" | "needs_reconnect" | "disabled";
};

function expiresAt(t: TokenResponse, now = Date.now()): string {
  // expires_in이 없으면 문서상 수명(60일)으로 본다
  return new Date(now + (t.expires_in ?? 60 * 24 * 3600) * 1000).toISOString();
}

async function settingNumber(key: string, fallback: number): Promise<number> {
  const { data } = await db().from("app_settings").select("value").eq("key", key).maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) ? n : fallback;
}

/** OAuth 완료 후 장기 토큰으로 계정을 저장(신규) 또는 갱신(재연결) */
export async function upsertAccountFromToken(longLived: TokenResponse) {
  const me = await getMe(longLived.access_token);
  const now = Date.now();

  const { data: existing } = await db()
    .from("threads_accounts")
    .select("id")
    .eq("threads_user_id", me.id)
    .maybeSingle();

  const fields = {
    username: me.username,
    profile_picture_url: me.threads_profile_picture_url ?? null,
    access_token_enc: encryptToken(longLived.access_token),
    token_expires_at: expiresAt(longLived, now),
    token_refreshed_at: new Date(now).toISOString(),
    status: "active" as const,
  };

  if (existing) {
    const { error } = await db().from("threads_accounts").update(fields).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id as string, username: me.username, isNew: false };
  }

  const { count } = await db().from("threads_accounts").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_ACCOUNTS) throw new Error(`계정은 최대 ${MAX_ACCOUNTS}개까지 연결할 수 있습니다.`);

  const { data, error } = await db()
    .from("threads_accounts")
    .insert({
      threads_user_id: me.id,
      daily_post_limit: await settingNumber("default_daily_post_limit", 10),
      ...fields,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, username: me.username, isNew: true };
}

export async function getAccount(accountId: string): Promise<AccountRow> {
  const { data, error } = await db()
    .from("threads_accounts")
    .select("id, threads_user_id, username, access_token_enc, token_expires_at, token_refreshed_at, status")
    .eq("id", accountId)
    .single();
  if (error || !data) throw new Error("계정을 찾을 수 없습니다.");
  return data as AccountRow;
}

export function accountToken(acc: AccountRow): string {
  if (!acc.access_token_enc) throw new Error(`@${acc.username} 계정의 토큰이 없습니다. 다시 연결하세요.`);
  return decryptToken(acc.access_token_enc);
}

export async function markNeedsReconnect(acc: Pick<AccountRow, "id" | "username">, reason: string) {
  await db().from("threads_accounts").update({ status: "needs_reconnect" }).eq("id", acc.id);
  await notify("error", "token_expired", `@${acc.username} 계정을 다시 연결해야 합니다. (${reason})`, "/settings");
}

/** API 오류가 토큰 문제면 재연결 필요로 표시 */
export async function handleAuthError(acc: Pick<AccountRow, "id" | "username">, err: unknown) {
  if (err instanceof ThreadsApiError && err.isAuthError) await markNeedsReconnect(acc, err.message);
}

export type RefreshResult = "refreshed" | "skipped" | "expired" | "failed";

/**
 * 만료 7일 이내면 갱신. 문서상 발급 후 24시간이 지나야 갱신 가능.
 * 이미 만료됐거나 갱신에 실패하면 needs_reconnect + 알림.
 */
export async function refreshAccountToken(acc: AccountRow, now = Date.now()): Promise<RefreshResult> {
  const exp = acc.token_expires_at ? Date.parse(acc.token_expires_at) : 0;
  const refreshedAt = acc.token_refreshed_at ? Date.parse(acc.token_refreshed_at) : 0;

  if (!acc.access_token_enc || exp <= now) {
    await markNeedsReconnect(acc, "토큰 만료");
    return "expired";
  }
  if (exp - now > 7 * DAY_MS || now - refreshedAt < DAY_MS) return "skipped";

  try {
    const t = await refreshLongLived(decryptToken(acc.access_token_enc));
    const { error } = await db()
      .from("threads_accounts")
      .update({
        access_token_enc: encryptToken(t.access_token),
        token_expires_at: expiresAt(t, now),
        token_refreshed_at: new Date(now).toISOString(),
      })
      .eq("id", acc.id);
    if (error) throw new Error(error.message);
    return "refreshed";
  } catch (err) {
    await markNeedsReconnect(acc, err instanceof Error ? err.message : "갱신 실패");
    return "failed";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 텍스트 글 즉시 발행(설정 화면의 테스트 버튼용).
 * 컨테이너 생성 → 상태가 FINISHED가 될 때까지 짧게 대기 → 발행 → permalink 조회 → posts에 기록
 */
export async function publishTextNow(accountId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("내용을 입력하세요.");
  if (countThreadsChars(trimmed) > THREADS_TEXT_LIMIT) throw new Error(`${THREADS_TEXT_LIMIT}자를 넘었습니다.`);

  const acc = await getAccount(accountId);
  if (acc.status !== "active") throw new Error(`@${acc.username} 계정 상태가 '${acc.status}'라서 발행할 수 없습니다.`);
  const token = accountToken(acc);

  const { data: post, error: insErr } = await db()
    .from("posts")
    .insert({ account_id: acc.id, kind: "general", status: "processing", text: trimmed, attempt_count: 1 })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);

  const log = (step: string, message?: string, error?: string) =>
    db().from("publish_logs").insert({ post_id: post.id, step, attempt: 1, message, error });

  try {
    const limit = await getPublishingLimit(acc.threads_user_id, token);
    if (limit && limit.quota_usage >= limit.config.quota_total) {
      throw new Error(`24시간 게시 한도(${limit.config.quota_total})를 모두 사용했습니다.`);
    }

    const containerId = await createContainer(acc.threads_user_id, token, { media_type: "TEXT", text: trimmed });
    await db().from("posts").update({ container_id: containerId }).eq("id", post.id);
    await log("container_created", containerId);

    // 텍스트는 보통 즉시 준비된다. 최대 약 20초 확인
    for (let i = 0; i < 10; i++) {
      const st = await getContainerStatus(containerId, token);
      if (st.status === "FINISHED") break;
      if (st.status === "ERROR" || st.status === "EXPIRED") {
        throw new Error(`컨테이너 상태 ${st.status}${st.error_message ? `: ${st.error_message}` : ""}`);
      }
      await sleep(2000);
    }

    const mediaId = await publishContainer(acc.threads_user_id, token, containerId);
    const media = await getMedia(mediaId, token).catch(() => null);
    const permalink = media?.permalink ?? null;

    await db()
      .from("posts")
      .update({
        status: "published",
        threads_media_id: mediaId,
        permalink,
        published_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", post.id);
    await log("published", mediaId);
    await notify("info", "publish_success", `@${acc.username} 테스트 글을 발행했습니다.`, permalink ?? "/published");
    return { mediaId, permalink };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db().from("posts").update({ status: "failed", last_error: msg }).eq("id", post.id);
    await log("failed", undefined, msg);
    await notify("error", "publish_failed", `@${acc.username} 테스트 발행 실패: ${msg}`, "/activity");
    await handleAuthError(acc, err);
    throw new Error(msg);
  }
}
