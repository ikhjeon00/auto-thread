import Link from "next/link";
import { AlertTriangle, Archive, Link2Off } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardView, type DashAccount, type DashStat } from "@/components/dashboard/dashboard-view";
import { addDays, kstRange, todayKst } from "@/lib/calendar";
import { db } from "@/lib/db/admin";
import { poolStocks } from "@/lib/pool/pick";
import { cn } from "@/lib/utils";

export const metadata = { title: "대시보드 · AUTO THREAD" };
export const dynamic = "force-dynamic";

async function count(q: PromiseLike<{ count: number | null }>) {
  return (await q).count ?? 0;
}

export default async function DashboardPage() {
  const today = todayKst();
  const { start, end } = kstRange(today, today);
  const head = { count: "exact" as const, head: true };
  const [accRes, groupRes, statRes, todayPublished, scheduled, total, failed, poolRes] = await Promise.all([
    db().from("threads_accounts").select("id, username, profile_picture_url, status, group_id, follower_count, last_synced_at").neq("status", "disabled").order("created_at"),
    db().from("account_groups").select("id, name, color").order("name"),
    db().from("account_daily_stats").select("account_id, date, followers, views, likes, replies").gte("date", addDays(today, -30)).limit(5000),
    count(db().from("posts").select("id", head).eq("status", "published").gte("published_at", start).lt("published_at", end)),
    count(db().from("posts").select("id", head).in("status", ["scheduled", "processing"])),
    count(db().from("posts").select("id", head).in("status", ["review", "scheduled", "processing", "published", "failed"])),
    count(db().from("posts").select("id", head).eq("status", "failed")),
    db().from("content_pools").select("id"),
  ]);
  const accounts = (accRes.data ?? []) as DashAccount[];
  const stocks = await poolStocks(((poolRes.data ?? []) as { id: string }[]).map((p) => p.id));
  const lowStock = [...stocks.values()].filter((s) => s.low).length;
  const reconnect = accounts.filter((a) => a.status === "needs_reconnect").length;

  const summary = [
    { label: "연결된 계정", value: accounts.filter((a) => a.status === "active").length, href: "/settings" },
    { label: "오늘 발행된 글", value: todayPublished, href: "/published" },
    { label: "예약된 글", value: scheduled, href: "/scheduled" },
    { label: "총 작성된 글", value: total, href: "/scheduled?status=scheduled,processing,failed,published" },
  ];
  const ops = [
    { label: "발행 실패", value: failed, href: "/scheduled?status=failed", icon: AlertTriangle, tone: "error" },
    { label: "재연결 필요", value: reconnect, href: "/settings", icon: Link2Off, tone: "error" },
    { label: "창고 재고 부족", value: lowStock, href: "/pools", icon: Archive, tone: "warn" },
  ] as const;

  return (
    <>
      <PageHeader title="대시보드" description="계정 현황과 발행 성과를 한눈에 봅니다. 통계는 3시간마다 모아 둔 값입니다." />
      {accRes.error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">불러오기 실패: {accRes.error.message}</p>}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {summary.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="h-full gap-2 transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent className="num text-3xl font-bold">{s.value.toLocaleString("ko-KR")}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ops.map((o) => {
          const Icon = o.icon;
          const alert = o.value > 0;
          return (
            <Link
              key={o.label}
              href={o.href}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-card transition-shadow hover:shadow-md",
                alert && o.tone === "error" && "border-red-200 bg-red-50",
                alert && o.tone === "warn" && "border-orange-200 bg-primary-soft",
              )}
            >
              <Icon className={cn("size-5", alert ? (o.tone === "error" ? "text-destructive" : "text-warning") : "text-muted-foreground")} />
              <span className="flex-1">{o.label}</span>
              <span className={cn("num text-xl font-bold", alert ? (o.tone === "error" ? "text-destructive" : "text-warning") : "text-muted-foreground")}>{o.value}</span>
            </Link>
          );
        })}
      </div>
      <DashboardView accounts={accounts} groups={(groupRes.data ?? []) as { id: string; name: string; color: string }[]} stats={(statRes.data ?? []) as DashStat[]} today={today} />
    </>
  );
}
