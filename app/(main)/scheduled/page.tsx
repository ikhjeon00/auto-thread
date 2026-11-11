import { PageHeader } from "@/components/layout/page-header";
import { ScheduledView } from "@/components/scheduled/scheduled-view";
import { DEFAULT_STATUSES, FILTER_STATUSES, type PostStatus, type ScheduledItem } from "@/components/scheduled/types";
import { isDayKey, kstRange, monthGrid, todayKst, weekDays } from "@/lib/calendar";
import { db } from "@/lib/db/admin";
import { findConflicts } from "@/lib/scheduler/conflicts";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/settings";

export const metadata = { title: "예약한 글 · AUTO THREAD" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SP = { view?: string; d?: string; account?: string; status?: string; post?: string; page?: string };

export default async function ScheduledPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = sp.view === "month" || sp.view === "week" ? sp.view : "list";
  const anchor = isDayKey(sp.d) ? sp.d : todayKst();
  const statuses = (sp.status?.split(",").filter((s): s is PostStatus => FILTER_STATUSES.includes(s as PostStatus)) ?? []).length
    ? (sp.status!.split(",") as PostStatus[])
    : DEFAULT_STATUSES;
  const accountId = sp.account && /^[0-9a-f-]{36}$/.test(sp.account) ? sp.account : null;
  const page = Math.max(1, Number(sp.page) || 1);

  // 댓글만 실패한 발행 글도 '실패'로 보여준다
  const failedReplyRes = statuses.includes("failed")
    ? await db().from("post_replies").select("post_id").eq("status", "failed").limit(500)
    : { data: [] as { post_id: string }[] };
  const replyFailedIds = [...new Set((failedReplyRes.data ?? []).map((r) => r.post_id as string))];

  let q = db()
    .from("posts")
    .select(
      "id, account_id, status, kind, scheduled_at, text, last_error, attempt_count, permalink, next_attempt_at, threads_accounts(username, profile_picture_url), post_media(id), post_replies(id, status)",
      { count: "exact" },
    );
  const statusOr = [`status.in.(${statuses.join(",")})`, ...(replyFailedIds.length ? [`id.in.(${replyFailedIds.join(",")})`] : [])].join(",");
  q = q.or(statusOr);
  if (accountId) q = q.eq("account_id", accountId);

  if (view === "list") {
    q = q.order("scheduled_at", { ascending: true, nullsFirst: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  } else {
    const days = view === "month" ? monthGrid(anchor) : weekDays(anchor);
    const { start, end } = kstRange(days[0], days[days.length - 1]);
    q = q.gte("scheduled_at", start).lt("scheduled_at", end).order("scheduled_at").limit(2000);
  }

  const [postsRes, accRes, settings] = await Promise.all([
    q,
    db().from("threads_accounts").select("id, username").neq("status", "disabled").order("username"),
    getSettings().catch(() => DEFAULT_SETTINGS),
  ]);

  const items: ScheduledItem[] = (postsRes.data ?? []).map((p) => {
    const acc = p.threads_accounts as unknown as { username: string; profile_picture_url: string | null } | null;
    const replies = (p.post_replies ?? []) as { status: string }[];
    return {
      id: p.id as string,
      accountId: p.account_id as string,
      username: acc?.username ?? "알 수 없음",
      avatarUrl: acc?.profile_picture_url ?? null,
      status: p.status as PostStatus,
      kind: p.kind as "general" | "product",
      scheduledAt: p.scheduled_at as string | null,
      text: p.text as string,
      mediaCount: ((p.post_media ?? []) as unknown[]).length,
      replyCount: replies.length,
      repliesFailed: replies.filter((r) => r.status === "failed").length,
      lastError: p.last_error as string | null,
      attemptCount: p.attempt_count as number,
      permalink: p.permalink as string | null,
      nextAttemptAt: p.next_attempt_at as string | null,
    };
  });

  // 최소 간격 이내로 겹친 예약 표시
  const active = items.filter((i) => (i.status === "scheduled" || i.status === "processing") && i.scheduledAt);
  const slots = active.map((i) => ({ id: i.id, accountId: i.accountId, at: Date.parse(i.scheduledAt!) }));
  const gaps = { minGapMinutes: settings.minGapMinutes, sameAccountGapMinutes: settings.sameAccountGapMinutes };
  const conflictIds = slots.filter((s) => findConflicts({ accountId: s.accountId, at: s.at, excludeId: s.id }, slots, gaps).length > 0).map((s) => s.id);

  return (
    <>
      <PageHeader title="예약한 글" description="예약·발행 중·실패한 글을 캘린더와 목록으로 관리합니다. 시간은 모두 KST입니다." />
      {postsRes.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">불러오기 실패: {postsRes.error.message}</p>
      )}
      <ScheduledView
        items={items}
        view={view}
        anchor={anchor}
        statuses={statuses}
        accountId={accountId}
        accounts={(accRes.data ?? []) as { id: string; username: string }[]}
        conflictIds={conflictIds}
        focusId={sp.post ?? null}
        page={page}
        pageCount={view === "list" ? Math.max(1, Math.ceil((postsRes.count ?? 0) / PAGE_SIZE)) : 1}
        total={postsRes.count ?? items.length}
        minGapMinutes={settings.minGapMinutes}
      />
    </>
  );
}
