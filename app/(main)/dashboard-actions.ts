"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth/require";
import { errorMessage } from "@/lib/errors";
import { db } from "@/lib/db/admin";

export type AccountDetail = {
  recent: { id: string; text: string; publishedAt: string; permalink: string | null; views: number; likes: number; replies: number; reposts: number }[];
  upcoming: { id: string; text: string; scheduledAt: string; status: string }[];
};

/** 대시보드 우측 패널: 최근 게시물 성과, 예약된 글 (DB만 읽음) */
export async function accountDetailAction(accountId: string): Promise<{ ok: true; data: AccountDetail } | { ok: false; error: string }> {
  try {
    await requireSession();
    const id = z.string().uuid().parse(accountId);
    const [recentRes, upRes] = await Promise.all([
      db()
        .from("posts")
        .select("id, text, published_at, permalink, post_insights(views, likes, replies, reposts)")
        .eq("account_id", id)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(10),
      db()
        .from("posts")
        .select("id, text, scheduled_at, status")
        .eq("account_id", id)
        .in("status", ["scheduled", "review", "processing"])
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at")
        .limit(10),
    ]);
    type Ins = { views: number; likes: number; replies: number; reposts: number };
    return {
      ok: true,
      data: {
        recent: ((recentRes.data ?? []) as unknown as { id: string; text: string; published_at: string; permalink: string | null; post_insights: Ins | Ins[] | null }[]).map((p) => {
          const i = (Array.isArray(p.post_insights) ? p.post_insights[0] : p.post_insights) ?? { views: 0, likes: 0, replies: 0, reposts: 0 };
          return { id: p.id, text: p.text, publishedAt: p.published_at, permalink: p.permalink, views: i.views, likes: i.likes, replies: i.replies, reposts: i.reposts };
        }),
        upcoming: ((upRes.data ?? []) as { id: string; text: string; scheduled_at: string; status: string }[]).map((p) => ({ id: p.id, text: p.text, scheduledAt: p.scheduled_at, status: p.status })),
      },
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
