import { PageHeader } from "@/components/layout/page-header";
import { ActivityList, type NotificationItem } from "@/components/activity/activity-list";
import { db } from "@/lib/db/admin";

export const metadata = { title: "활동 · AUTO THREAD" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const TYPES: Record<string, string> = {
  publish: "발행",
  token: "토큰·계정",
  stock: "재고",
  ai: "AI",
};

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ filter?: string; level?: string; type?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const unreadOnly = sp.filter === "unread";
  const level = sp.level === "error" || sp.level === "warn" || sp.level === "info" ? sp.level : null;
  const type = sp.type && sp.type in TYPES ? sp.type : null;

  let q = db()
    .from("notifications")
    .select("id, level, type, message, link, is_read, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (unreadOnly) q = q.eq("is_read", false);
  if (level) q = q.eq("level", level);
  if (type === "publish") q = q.or("type.like.publish%,type.like.reply%");
  if (type === "token") q = q.or("type.like.token%,type.like.account%");
  if (type === "stock") q = q.like("type", "stock%");
  if (type === "ai") q = q.like("type", "ai%");

  const [res, unread] = await Promise.all([q, db().from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false)]);

  return (
    <>
      <PageHeader title="활동" description="발행 결과, 토큰 만료, 재고 부족, AI 오류 알림을 확인합니다." />
      {res.error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">불러오기 실패: {res.error.message}</p>}
      <ActivityList
        items={(res.data ?? []) as NotificationItem[]}
        unreadCount={unread.count ?? 0}
        filter={{ unreadOnly, level, type }}
        types={TYPES}
        page={page}
        pageCount={Math.max(1, Math.ceil((res.count ?? 0) / PAGE_SIZE))}
      />
    </>
  );
}
