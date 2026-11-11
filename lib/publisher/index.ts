import "server-only";
import { db } from "@/lib/db/admin";
import { notify } from "@/lib/notify";
import { markPoolItemUsed } from "@/lib/pool/pick";
import { accountToken, handleAuthError, type AccountRow } from "@/lib/threads/accounts";
import {
  ThreadsApiError,
  createContainer,
  getContainerStatus,
  getMedia,
  getPublishingLimit,
  publishContainer,
  type ContainerStatus,
} from "@/lib/threads/client";

/**
 * 발행 상태 머신 (작업지시서 6장)
 *   scheduled → processing(컨테이너 생성·상태 확인) → published → 댓글 순서대로 발행
 * 한 번의 실행에서 가능한 만큼 진행하고, 기다려야 하면 next_attempt_at 을 잡고 다음 실행으로 넘긴다.
 * 실패하면 1분 → 5분 → 15분 뒤 재시도, 3회 실패 시 failed + 알림.
 */

export const RETRY_DELAYS_MIN = [1, 5, 15];
export const MAX_ATTEMPTS = 3;
const CONTAINER_WAIT_SEC = 30; // 컨테이너 처리 대기 후 다시 확인
const CONTAINER_TIMEOUT_MIN = 20; // 이 시간이 지나도 FINISHED가 아니면 실패로 본다
const MEDIA_RETENTION_DAYS = 30;

type PostRow = {
  id: string;
  account_id: string;
  pool_item_id: string | null;
  status: string;
  text: string;
  link_url: string | null;
  link_position: "body" | "first_reply" | null;
  topic_tag: string | null;
  is_ai_label: boolean;
  scheduled_at: string | null;
  container_id: string | null;
  container_created_at: string | null;
  threads_media_id: string | null;
  attempt_count: number;
  replies_pending: boolean;
};

type MediaRow = { id: string; public_url: string; media_type: "image" | "video"; sort_order: number; container_id: string | null };
type ReplyRow = {
  id: string;
  text: string;
  media_type: "image" | "video" | null;
  media_url: string | null;
  sort_order: number;
  container_id: string | null;
  threads_media_id: string | null;
  status: string;
  attempt_count: number;
};

/** 기다려야 함(오류 아님) */
class Wait extends Error {
  constructor(public readonly seconds: number, message = "처리 대기") {
    super(message);
  }
}
/** 재시도해도 소용없는 오류 */
class Fatal extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();

async function log(postId: string, step: string, attempt: number, message?: string, error?: string) {
  await db().from("publish_logs").insert({ post_id: postId, step, attempt, message: message ?? null, error: error ?? null });
}

async function updatePost(id: string, patch: Record<string, unknown>) {
  const { error } = await db().from("posts").update(patch).eq("id", id);
  if (error) throw new Error(`DB 저장 실패: ${error.message}`);
}

function assertUsable(st: ContainerStatus, what: string) {
  if (st.status === "ERROR" || st.status === "EXPIRED") {
    throw new Error(`${what} 상태 ${st.status}${st.error_message ? ` (${st.error_message})` : ""}`);
  }
}

/** 텍스트 컨테이너는 보통 금방 준비된다. 몇 초만 확인하고, 아니면 다음 실행으로 */
async function waitBriefly(containerId: string, token: string, tries = 3): Promise<ContainerStatus> {
  let st = await getContainerStatus(containerId, token);
  for (let i = 1; i < tries && st.status === "IN_PROGRESS"; i++) {
    await sleep(1500);
    st = await getContainerStatus(containerId, token);
  }
  return st;
}

export type BatchResult = { claimed: number; published: number; repliesPublished: number; waiting: number; retried: number; failed: number };

export async function runPublishBatch(deadline: number, limit = 10): Promise<BatchResult> {
  const result: BatchResult = { claimed: 0, published: 0, repliesPublished: 0, waiting: 0, retried: 0, failed: 0 };
  const { data, error } = await db().rpc("claim_due_posts", { p_limit: limit, p_lease_seconds: 120 });
  if (error) throw new Error(`claim_due_posts 실패: ${error.message}`);
  const posts = (data ?? []) as PostRow[];
  result.claimed = posts.length;

  // 같은 회차에 메인 글 발행은 1개만. 나머지는 30초~2분 간격으로 미룬다(작업지시서 8장)
  const gate = { publishedThisRun: false, staggerOffsetSec: 0 };

  for (const post of posts) {
    if (Date.now() > deadline) {
      await updatePost(post.id, { locked_until: null }); // 다음 실행이 가져가도록 잠금 해제
      continue;
    }
    try {
      await processPost(post, gate, result, deadline);
    } catch (e) {
      console.error("[publish] 예기치 못한 오류", post.id, e);
    } finally {
      await db().from("posts").update({ locked_until: null }).eq("id", post.id);
    }
  }
  return result;
}

async function loadAccount(accountId: string): Promise<AccountRow> {
  const { data, error } = await db()
    .from("threads_accounts")
    .select("id, threads_user_id, username, access_token_enc, token_expires_at, token_refreshed_at, status")
    .eq("id", accountId)
    .single();
  if (error || !data) throw new Fatal("계정을 찾을 수 없습니다.");
  return data as AccountRow;
}

async function processPost(post: PostRow, gate: { publishedThisRun: boolean; staggerOffsetSec: number }, result: BatchResult, deadline: number) {
  const account = await loadAccount(post.account_id).catch((e) => e as Error);
  const isReplyPhase = post.status === "published";

  try {
    if (account instanceof Error) throw new Fatal(account.message);
    if (account.status !== "active") {
      throw new Fatal(`@${account.username} 계정이 ${account.status === "needs_reconnect" ? "재연결 필요" : "해제"} 상태입니다.`);
    }
    const token = accountToken(account);

    if (isReplyPhase) {
      const n = await publishReplies(post, account, token, deadline);
      result.repliesPublished += n;
      return;
    }

    if (post.status === "scheduled") {
      await updatePost(post.id, { status: "processing", last_error: null });
      post.status = "processing";
      await log(post.id, "start", post.attempt_count + 1);
    }

    // 1) 컨테이너 준비
    if (!post.container_id) {
      await createMainContainer(post, account, token);
    }

    // 2) 상태 확인
    const st = post.container_created_at && Date.now() - Date.parse(post.container_created_at) < 5_000
      ? await waitBriefly(post.container_id!, token)
      : await getContainerStatus(post.container_id!, token);
    if (st.status === "PUBLISHED") {
      throw new Fatal("컨테이너가 이미 발행된 상태입니다. Threads에서 직접 확인하세요(중복 발행 방지를 위해 중단).");
    }
    if (st.status === "ERROR" || st.status === "EXPIRED") {
      // 다음 시도에서 컨테이너를 새로 만들도록 초기화
      await updatePost(post.id, { container_id: null, container_created_at: null });
      await db().from("post_media").update({ container_id: null }).eq("post_id", post.id);
      assertUsable(st, "게시물 컨테이너");
    }
    if (st.status === "IN_PROGRESS") {
      const age = post.container_created_at ? Date.now() - Date.parse(post.container_created_at) : 0;
      if (age > CONTAINER_TIMEOUT_MIN * 60_000) {
        await updatePost(post.id, { container_id: null, container_created_at: null });
        throw new Error(`컨테이너가 ${CONTAINER_TIMEOUT_MIN}분 넘게 처리 중입니다.`);
      }
      throw new Wait(CONTAINER_WAIT_SEC, "미디어 처리 중");
    }

    // 3) 발행 간격 조절
    if (gate.publishedThisRun) {
      gate.staggerOffsetSec += 30 + Math.floor(Math.random() * 91); // 30~120초
      throw new Wait(gate.staggerOffsetSec, "발행 간격 조절");
    }

    // 4) 24시간 한도 확인
    const lim = await getPublishingLimit(account.threads_user_id, token).catch(() => null);
    if (lim && lim.quota_usage >= lim.config.quota_total) {
      throw new Wait(30 * 60, `24시간 게시 한도(${lim.config.quota_total}) 도달`);
    }

    // 5) 발행
    const mediaId = await publishContainer(account.threads_user_id, token, post.container_id!);
    gate.publishedThisRun = true;
    const media = await getMedia(mediaId, token).catch(() => null);
    const { count: replyCount } = await db()
      .from("post_replies")
      .select("id", { count: "exact", head: true })
      .eq("post_id", post.id)
      .neq("status", "published");
    const publishedAt = nowIso();
    await updatePost(post.id, {
      status: "published",
      threads_media_id: mediaId,
      permalink: media?.permalink ?? null,
      published_at: publishedAt,
      attempt_count: 0,
      next_attempt_at: null,
      last_error: null,
      replies_pending: (replyCount ?? 0) > 0,
    });
    // 글 작성에서 직접 올린 1회용 첨부(uploads/…)만 30일 뒤 삭제. 자료실·상품 사진은 보관
    await db()
      .from("post_media")
      .update({ delete_after: new Date(Date.now() + MEDIA_RETENTION_DAYS * 86_400_000).toISOString() })
      .eq("post_id", post.id)
      .is("delete_after", null)
      .like("storage_path", "uploads/%");
    await log(post.id, "published", post.attempt_count + 1, mediaId);
    if (post.pool_item_id) {
      await markPoolItemUsed(post.pool_item_id, account.id, post.id).catch((e) => console.error("[publish] 창고 사용 기록 실패", e));
    }
    await notify("info", "publish_success", `@${account.username} 글을 발행했습니다.`, media?.permalink ?? "/published");
    result.published++;

    // 댓글이 있으면 시간이 남는 한 바로 이어서 올린다
    if ((replyCount ?? 0) > 0 && Date.now() < deadline - 8_000) {
      post.threads_media_id = mediaId;
      post.attempt_count = 0;
      result.repliesPublished += await publishReplies(post, account, token, deadline);
    }
  } catch (e) {
    await handleFailure(post, account instanceof Error ? null : account, e, result, isReplyPhase);
  }
}

async function createMainContainer(post: PostRow, account: AccountRow, token: string) {
  const { data: mediaRows, error } = await db()
    .from("post_media")
    .select("id, public_url, media_type, sort_order, container_id")
    .eq("post_id", post.id)
    .order("sort_order");
  if (error) throw new Error(error.message);
  const media = (mediaRows ?? []) as MediaRow[];
  const uid = account.threads_user_id;
  const common = {
    text: post.text || undefined,
    topic_tag: post.topic_tag || undefined,
    is_made_with_ai: post.is_ai_label || undefined,
  };

  let containerId: string;
  if (media.length === 0) {
    const linkAttachment = post.link_url && post.link_position === "body" ? post.link_url : undefined;
    containerId = await createContainer(uid, token, { media_type: "TEXT", ...common, link_attachment: linkAttachment });
  } else if (media.length === 1) {
    const m = media[0];
    containerId = await createContainer(uid, token, {
      media_type: m.media_type === "video" ? "VIDEO" : "IMAGE",
      ...(m.media_type === "video" ? { video_url: m.public_url } : { image_url: m.public_url }),
      ...common,
    });
  } else {
    // 캐러셀: 항목 컨테이너 → 모두 FINISHED → 부모 컨테이너
    for (const m of media) {
      if (m.container_id) continue;
      m.container_id = await createContainer(uid, token, {
        media_type: m.media_type === "video" ? "VIDEO" : "IMAGE",
        ...(m.media_type === "video" ? { video_url: m.public_url } : { image_url: m.public_url }),
        is_carousel_item: true,
      });
      await db().from("post_media").update({ container_id: m.container_id }).eq("id", m.id);
    }
    await log(post.id, "carousel_items", post.attempt_count + 1, `${media.length}개 항목 컨테이너`);
    let pending = 0;
    for (const m of media) {
      const st = await getContainerStatus(m.container_id!, token);
      if (st.status === "ERROR" || st.status === "EXPIRED") {
        await db().from("post_media").update({ container_id: null }).eq("post_id", post.id);
        assertUsable(st, `${m.sort_order + 1}번째 미디어`);
      }
      if (st.status !== "FINISHED") pending++;
    }
    if (pending > 0) throw new Wait(CONTAINER_WAIT_SEC, `캐러셀 항목 ${pending}개 처리 중`);
    // is_made_with_ai 는 부모 컨테이너에만(문서)
    containerId = await createContainer(uid, token, {
      media_type: "CAROUSEL",
      children: media.map((m) => m.container_id!),
      ...common,
    });
  }

  const createdAt = nowIso();
  await updatePost(post.id, { container_id: containerId, container_created_at: createdAt });
  post.container_id = containerId;
  post.container_created_at = createdAt;
  await log(post.id, "container_created", post.attempt_count + 1, containerId);
}

/** 댓글을 순서대로 발행. 각 댓글은 바로 앞 댓글(첫 댓글은 본문)에 단다 → 스레드 형태 */
async function publishReplies(post: PostRow, account: AccountRow, token: string, deadline: number): Promise<number> {
  const { data, error } = await db()
    .from("post_replies")
    .select("id, text, media_type, media_url, sort_order, container_id, threads_media_id, status, attempt_count")
    .eq("post_id", post.id)
    .order("sort_order");
  if (error) throw new Error(error.message);
  const replies = (data ?? []) as ReplyRow[];
  let parentId = post.threads_media_id!;
  let published = 0;

  for (const r of replies) {
    if (r.status === "published" && r.threads_media_id) {
      parentId = r.threads_media_id;
      continue;
    }
    if (r.status === "failed") continue; // 포기한 댓글은 건너뛴다
    if (Date.now() > deadline - 6_000) throw new Wait(5, "시간 부족, 다음 실행에서 계속");

    if (!r.container_id) {
      const media =
        r.media_url && r.media_type === "video"
          ? ({ media_type: "VIDEO", video_url: r.media_url } as const)
          : r.media_url
            ? ({ media_type: "IMAGE", image_url: r.media_url } as const)
            : ({ media_type: "TEXT" } as const);
      r.container_id = await createContainer(account.threads_user_id, token, {
        ...media,
        text: r.text || undefined,
        reply_to_id: parentId,
      });
      await db().from("post_replies").update({ container_id: r.container_id, status: "processing" }).eq("id", r.id);
    }
    const st = await waitBriefly(r.container_id, token);
    if (st.status === "ERROR" || st.status === "EXPIRED") {
      await db().from("post_replies").update({ container_id: null }).eq("id", r.id);
      assertUsable(st, `${r.sort_order + 1}번째 댓글`);
    }
    if (st.status !== "FINISHED") {
      // 사진·영상 댓글은 처리 시간이 걸린다. 너무 오래 걸리면 컨테이너를 다시 만든다
      throw new Wait(CONTAINER_WAIT_SEC, r.media_url ? "댓글 미디어 처리 중" : "댓글 처리 중");
    }

    const mediaId = await publishContainer(account.threads_user_id, token, r.container_id);
    await db()
      .from("post_replies")
      .update({ threads_media_id: mediaId, status: "published", last_error: null })
      .eq("id", r.id);
    await log(post.id, `reply_${r.sort_order + 1}`, r.attempt_count + 1, mediaId);
    parentId = mediaId;
    published++;
  }

  await updatePost(post.id, { replies_pending: false, attempt_count: 0, next_attempt_at: null, last_error: null });
  return published;
}

async function handleFailure(post: PostRow, account: AccountRow | null, e: unknown, result: BatchResult, isReplyPhase: boolean) {
  if (e instanceof Wait) {
    await updatePost(post.id, { next_attempt_at: inSeconds(e.seconds) });
    await log(post.id, "wait", post.attempt_count + 1, `${e.message} (${e.seconds}초 뒤)`);
    result.waiting++;
    return;
  }

  const msg = e instanceof Error ? e.message : String(e);
  if (account) await handleAuthError(account, e);
  const authBroken = e instanceof ThreadsApiError && e.isAuthError;
  const attempt = post.attempt_count + 1;
  const giveUp = e instanceof Fatal || authBroken || attempt >= MAX_ATTEMPTS;
  const who = account ? `@${account.username}` : "계정";

  if (isReplyPhase) {
    // 본문은 이미 올라갔다. 다음 댓글을 실패 처리하고 나머지를 계속하거나 포기한다.
    const { data: next } = await db()
      .from("post_replies")
      .select("id, sort_order")
      .eq("post_id", post.id)
      .neq("status", "published")
      .neq("status", "failed")
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (giveUp) {
      await db().from("post_replies").update({ status: "failed", last_error: msg }).eq("post_id", post.id).neq("status", "published");
      await updatePost(post.id, { replies_pending: false, attempt_count: attempt, next_attempt_at: null, last_error: `댓글 발행 실패: ${msg}` });
      await notify("warn", "reply_failed", `${who} 글의 댓글 발행에 실패했습니다: ${msg}`, `/scheduled?post=${post.id}`);
      result.failed++;
    } else {
      if (next) await db().from("post_replies").update({ attempt_count: attempt, last_error: msg }).eq("id", next.id);
      await updatePost(post.id, { attempt_count: attempt, next_attempt_at: inSeconds(RETRY_DELAYS_MIN[attempt - 1] * 60), last_error: msg });
      result.retried++;
    }
    await log(post.id, "reply_error", attempt, undefined, msg);
    return;
  }

  if (giveUp) {
    await updatePost(post.id, { status: "failed", attempt_count: attempt, next_attempt_at: null, last_error: msg });
    await notify("error", "publish_failed", `${who} 글 발행 실패: ${msg}`, `/scheduled?post=${post.id}`);
    result.failed++;
  } else {
    await updatePost(post.id, {
      attempt_count: attempt,
      next_attempt_at: inSeconds(RETRY_DELAYS_MIN[attempt - 1] * 60),
      last_error: msg,
    });
    result.retried++;
  }
  await log(post.id, "error", attempt, undefined, msg);
}
