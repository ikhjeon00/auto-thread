import "server-only";
import { db } from "@/lib/db/admin";
import { getSettings } from "@/lib/settings";
import { buildPlan, hasErrors, type DisclosureLite } from "./plan";
import { composeSchema, type ComposeInput } from "./schema";

export const EDITABLE_STATUSES = ["draft", "review", "scheduled", "failed", "cancelled"] as const;

export async function loadDisclosure(id: string | null): Promise<DisclosureLite | null> {
  if (!id) return null;
  const { data } = await db()
    .from("disclosures")
    .select("id, name, text, match_domains, default_position")
    .eq("id", id)
    .maybeSingle();
  return (data as DisclosureLite | null) ?? null;
}

export type SaveOptions = {
  postId?: string | null;
  status: "draft" | "scheduled";
  scheduledAt?: Date | null;
};

/**
 * 작성 내용을 저장한다. 예약일 때는 검사 오류가 있으면 거부한다.
 * 본문(posts.text)과 댓글(post_replies)은 링크·고지 문구까지 반영한 "발행될 모습"으로 저장하고,
 * 작성 화면 원본은 posts.compose 에 보관한다.
 */
export async function savePost(raw: ComposeInput, opts: SaveOptions): Promise<{ postId: string }> {
  const input = composeSchema.parse(raw);
  const [disclosure, settings] = await Promise.all([loadDisclosure(input.disclosureId), getSettings()]);
  if (input.disclosureId && !disclosure) throw new Error("선택한 고지 문구를 찾을 수 없습니다.");
  const plan = buildPlan(input, { disclosure, bannedWords: settings.bannedWords });

  if (opts.status !== "draft") {
    if (hasErrors(plan)) throw new Error(plan.issues.filter((i) => i.level === "error").map((i) => i.message).join(" / "));
    if (!opts.scheduledAt) throw new Error("발행 시간을 지정하세요.");
    const { data: acc } = await db().from("threads_accounts").select("status, username").eq("id", input.accountId).single();
    if (!acc) throw new Error("계정을 찾을 수 없습니다.");
    if (acc.status !== "active") throw new Error(`@${acc.username} 계정은 지금 발행할 수 없는 상태입니다(${acc.status}).`);
  }

  const row = {
    account_id: input.accountId,
    kind: input.kind,
    status: opts.status,
    text: plan.mainText,
    link_url: input.linkUrl,
    link_position: plan.linkPosition,
    topic_tag: input.topicTag,
    disclosure_id: disclosure?.id ?? null,
    disclosure_position: plan.disclosurePosition,
    is_ai_label: input.isAiLabel,
    scheduled_at: opts.scheduledAt ? opts.scheduledAt.toISOString() : null,
    compose: input,
    attempt_count: 0,
    next_attempt_at: null,
    last_error: null,
    container_id: null,
    container_created_at: null,
    replies_pending: false,
  };

  let postId = opts.postId ?? null;
  if (postId) {
    const { data, error } = await db()
      .from("posts")
      .update(row)
      .eq("id", postId)
      .in("status", EDITABLE_STATUSES as unknown as string[])
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("이미 발행 중이거나 발행된 글은 수정할 수 없습니다.");
  } else {
    const { data, error } = await db().from("posts").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    postId = data.id as string;
  }

  // 미디어·댓글은 통째로 교체
  const delMedia = await db().from("post_media").delete().eq("post_id", postId);
  if (delMedia.error) throw new Error(delMedia.error.message);
  if (input.media.length) {
    const { error } = await db()
      .from("post_media")
      .insert(
        input.media.map((m, i) => ({
          post_id: postId,
          storage_path: m.storagePath,
          public_url: m.publicUrl,
          media_type: m.mediaType,
          sort_order: i,
        })),
      );
    if (error) throw new Error(error.message);
  }

  const delReplies = await db().from("post_replies").delete().eq("post_id", postId);
  if (delReplies.error) throw new Error(delReplies.error.message);
  if (plan.replies.length) {
    const { error } = await db()
      .from("post_replies")
      .insert(
        plan.replies.map((r, i) => ({
          post_id: postId,
          text: r.text,
          kind: r.kind,
          sort_order: i,
          status: "pending",
          media_type: r.media?.mediaType ?? null,
          media_url: r.media?.publicUrl ?? null,
          storage_path: r.media?.storagePath ?? null,
        })),
      );
    if (error) throw new Error(error.message);
  }

  return { postId: postId! };
}
