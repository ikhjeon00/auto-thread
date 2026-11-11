import "server-only";
import { fromZonedTime } from "date-fns-tz";
import { db } from "@/lib/db/admin";
import { addDays, todayKst } from "@/lib/calendar";
import { accountToken, handleAuthError, type AccountRow } from "@/lib/threads/accounts";
import { getMe, getMediaInsights, getUserInsights } from "@/lib/threads/client";
import { APP_TZ } from "@/lib/time";

/**
 * 통계 수집(DB 에만 저장, 대시보드는 DB만 읽는다)
 *  - 계정: 오늘·어제(KST) 조회·좋아요·댓글·리포스트·인용·클릭, 팔로워 수 스냅샷(오늘 행), 프로필 사진 갱신
 *  - 게시물: 최근 30일 발행 글 중 오래 갱신 안 된 순서로 인사이트 갱신
 */
const RANGE_METRICS = ["views", "likes", "replies", "reposts", "quotes", "clicks"] as const;

const unix = (day: string) => Math.floor(fromZonedTime(`${day}T00:00:00`, APP_TZ).getTime() / 1000);

async function pool<T>(items: T[], size: number, deadline: number, fn: (t: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (queue.length && Date.now() < deadline) await fn(queue.shift()!);
    }),
  );
  return queue.length;
}

export async function syncAccounts(deadline: number) {
  const { data } = await db()
    .from("threads_accounts")
    .select("id, threads_user_id, username, access_token_enc, token_expires_at, token_refreshed_at, status")
    .eq("status", "active");
  const accounts = (data ?? []) as AccountRow[];
  const today = todayKst();
  const yesterday = addDays(today, -1);
  const r = { accounts: accounts.length, ok: 0, failed: 0, remaining: 0 };

  r.remaining = await pool(accounts, 4, deadline, async (acc) => {
    try {
      const token = accountToken(acc);
      const nowSec = Math.floor(Date.now() / 1000);
      const [yd, td, fol, me] = await Promise.all([
        getUserInsights(acc.threads_user_id, token, [...RANGE_METRICS], { since: unix(yesterday), until: unix(today) }),
        getUserInsights(acc.threads_user_id, token, [...RANGE_METRICS], { since: unix(today), until: nowSec }),
        getUserInsights(acc.threads_user_id, token, ["followers_count"]),
        getMe(token).catch(() => null),
      ]);
      const followers = fol.followers_count ?? 0;
      const row = (date: string, v: Record<string, number>, withFollowers: boolean) => ({
        account_id: acc.id,
        date,
        views: v.views ?? 0,
        likes: v.likes ?? 0,
        replies: v.replies ?? 0,
        reposts: v.reposts ?? 0,
        quotes: v.quotes ?? 0,
        clicks: v.clicks ?? 0,
        ...(withFollowers ? { followers } : {}),
      });
      // 어제 행은 팔로워를 덮어쓰지 않는다(어제 마지막 값 유지). 어제 행이 없으면 오늘 값으로 채운다
      const { data: ydRow } = await db().from("account_daily_stats").select("followers").eq("account_id", acc.id).eq("date", yesterday).maybeSingle();
      const up = await db()
        .from("account_daily_stats")
        .upsert([row(yesterday, yd, !ydRow || ydRow.followers === null), row(today, td, true)], { onConflict: "account_id,date" });
      if (up.error) throw new Error(up.error.message);
      await db()
        .from("threads_accounts")
        .update({
          follower_count: followers,
          last_synced_at: new Date().toISOString(),
          ...(me ? { username: me.username, profile_picture_url: me.threads_profile_picture_url ?? null } : {}),
        })
        .eq("id", acc.id);
      r.ok++;
    } catch (e) {
      r.failed++;
      console.error("[sync] 계정", acc.username, e instanceof Error ? e.message : e);
      await handleAuthError(acc, e);
    }
  });
  return r;
}

export async function syncPosts(deadline: number, limit = 150) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await db()
    .from("posts")
    .select("id, threads_media_id, account_id, post_insights(updated_at), threads_accounts(id, threads_user_id, username, access_token_enc, token_expires_at, token_refreshed_at, status)")
    .eq("status", "published")
    .not("threads_media_id", "is", null)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(2000);
  type Row = { id: string; threads_media_id: string; post_insights: { updated_at: string } | { updated_at: string }[] | null; threads_accounts: AccountRow | null };
  const updatedAt = (r: Row) => {
    const pi = Array.isArray(r.post_insights) ? r.post_insights[0] : r.post_insights;
    return pi?.updated_at ? Date.parse(pi.updated_at) : 0;
  };
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.threads_accounts?.status === "active").sort((a, b) => updatedAt(a) - updatedAt(b)).slice(0, limit);
  const res = { posts: rows.length, ok: 0, failed: 0, remaining: 0 };
  const tokens = new Map<string, string>();
  res.remaining = await pool(rows, 5, deadline, async (p) => {
    try {
      const acc = p.threads_accounts!;
      if (!tokens.has(acc.id)) tokens.set(acc.id, accountToken(acc));
      const m = await getMediaInsights(p.threads_media_id, tokens.get(acc.id)!);
      const { error } = await db()
        .from("post_insights")
        .upsert({ post_id: p.id, views: m.views, likes: m.likes, replies: m.replies, reposts: m.reposts, quotes: m.quotes, shares: m.shares, updated_at: new Date().toISOString() }, { onConflict: "post_id" });
      if (error) throw new Error(error.message);
      res.ok++;
    } catch (e) {
      res.failed++;
      console.error("[sync] 게시물", p.id, e instanceof Error ? e.message : e);
    }
  });
  return res;
}
