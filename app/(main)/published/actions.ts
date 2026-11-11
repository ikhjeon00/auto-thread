"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require";
import { errorMessage } from "@/lib/errors";
import { db } from "@/lib/db/admin";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** ★ 보석함 저장/해제 (나의 보석함) */
export async function toggleBookmarkAction(postId: string): Promise<Result<{ saved: boolean }>> {
  try {
    await requireSession();
    const id = z.string().uuid().parse(postId);
    const { data: existing } = await db().from("bookmarks").select("id").eq("post_id", id).maybeSingle();
    if (existing) {
      const { error } = await db().from("bookmarks").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      revalidatePath("/published");
      return { ok: true, data: { saved: false } };
    }
    const { data: post } = await db()
      .from("posts")
      .select("account_id, text, permalink, post_insights(views, likes, replies, reposts, quotes, shares)")
      .eq("id", id)
      .single();
    if (!post) throw new Error("글을 찾을 수 없습니다.");
    const ins = Array.isArray(post.post_insights) ? post.post_insights[0] : post.post_insights;
    const { error } = await db().from("bookmarks").insert({
      kind: "mine",
      account_id: post.account_id,
      post_id: id,
      text: post.text,
      source_url: post.permalink,
      metrics: ins ?? {},
    });
    if (error) throw new Error(error.message);
    revalidatePath("/published");
    return { ok: true, data: { saved: true } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
