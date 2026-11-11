import "server-only";
import { db } from "@/lib/db/admin";
import { savePost } from "@/lib/compose/save";
import { pickOrGenerate } from "@/lib/pool/pick";
import type { FarmPostMeta } from "./types";

/**
 * "발행 직전 뽑기" 글: 발행할 때 창고에서 글을 뽑아 채운다.
 * 채웠으면 true, 뽑을 글이 없어 취소했으면 false.
 */
export async function fillAtPublish(post: { id: string; account_id: string; campaign_id: string | null; scheduled_at: string | null; ai_meta: { farm?: FarmPostMeta } | null }): Promise<boolean> {
  let poolId: string | null = null;
  let isAiLabel = false;
  if (post.campaign_id) {
    const { data } = await db().from("campaigns").select("config").eq("id", post.campaign_id).maybeSingle();
    const cfg = (data?.config ?? {}) as { poolId?: string | null; isAiLabel?: boolean };
    poolId = cfg.poolId ?? null;
    isAiLabel = !!cfg.isAiLabel;
  }
  const r = await pickOrGenerate(post.account_id, { poolId });
  if (!r.item) {
    await db().from("posts").update({ status: "cancelled", last_error: `발행 직전 뽑기 실패: ${r.reason}` }).eq("id", post.id);
    return false;
  }
  await savePost(
    { ...r.item.content, accountId: post.account_id, mode: "pool", poolItemId: r.item.id, isAiLabel: r.item.content.isAiLabel || isAiLabel },
    { postId: post.id, status: "scheduled", scheduledAt: post.scheduled_at ? new Date(post.scheduled_at) : new Date() },
  );
  await db()
    .from("posts")
    .update({ ai_meta: { farm: { ...(post.ai_meta?.farm ?? { type: "general" }), pickAtPublish: false, pickedAt: new Date().toISOString() } } })
    .eq("id", post.id);
  return true;
}
