import Link from "next/link";
import { AlertTriangle, Archive } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NewPool } from "@/components/pools/new-pool";
import { db } from "@/lib/db/admin";
import { poolStocks } from "@/lib/pool/pick";
import { cn } from "@/lib/utils";

export const metadata = { title: "글 창고 · AUTO THREAD" };
export const dynamic = "force-dynamic";

export default async function PoolsPage() {
  const [poolRes, accRes, genRes] = await Promise.all([
    db().from("content_pools").select("id, name, description, low_stock_days, auto_refill, reuse_cooldown_days, pool_accounts(threads_accounts(username))").order("created_at"),
    db().from("threads_accounts").select("id, username").neq("status", "disabled").order("username"),
    db().from("generators").select("id, name").eq("is_active", true).eq("kind", "daily").order("created_at"),
  ]);
  const pools = (poolRes.data ?? []) as unknown as {
    id: string;
    name: string;
    description: string | null;
    low_stock_days: number;
    auto_refill: boolean;
    reuse_cooldown_days: number | null;
    pool_accounts: { threads_accounts: { username: string } | null }[];
  }[];
  const stocks = await poolStocks(pools.map((p) => p.id));

  return (
    <>
      <PageHeader title="글 창고" description="발행할 글을 모아 두고, 계정마다 겹치지 않게 랜덤으로 꺼내 씁니다." />
      {poolRes.error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">불러오기 실패: {poolRes.error.message}</p>}
      <div className="mb-6 flex">
        <NewPool accounts={(accRes.data ?? []) as { id: string; username: string }[]} generators={(genRes.data ?? []) as { id: string; name: string }[]} />
      </div>
      {pools.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Archive className="size-8" />
            아직 창고가 없습니다. &lsquo;새 창고&rsquo;로 만들고 글을 채워 보세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pools.map((p) => {
            const s = stocks.get(p.id);
            const users = p.pool_accounts.map((a) => a.threads_accounts?.username).filter(Boolean);
            return (
              <Link key={p.id} href={`/pools/${p.id}`} className="group">
                <Card className={cn("h-full transition-shadow group-hover:shadow-md", s?.low && "border-warning/60")}>
                  <CardContent className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{p.name}</div>
                        {p.description && <div className="line-clamp-1 text-sm text-muted-foreground">{p.description}</div>}
                      </div>
                      {s?.low && (
                        <Badge variant="warning">
                          <AlertTriangle className="size-3" /> 재고 부족
                        </Badge>
                      )}
                    </div>
                    <div className={cn("num text-sm", s?.low ? "font-semibold text-warning" : "text-foreground")}>
                      남은 글 {s?.available ?? 0}개{s?.days !== null && s?.days !== undefined ? ` · 약 ${s.days}일 분량` : ""}
                    </div>
                    <div className="num flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>검수 대기 {s?.pending ?? 0}</span>
                      <span>예약됨 {s?.reserved ?? 0}</span>
                      <span>사용 완료 {s?.used ?? 0}</span>
                      <span>하루 약 {s?.dailyNeed ?? 0}개 사용</span>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-1">
                      {users.length ? users.map((u) => <Badge key={u} variant="outline">@{u}</Badge>) : <span className="text-xs text-muted-foreground">연결 계정 없음</span>}
                      {p.auto_refill && <Badge>자동 보충</Badge>}
                      {p.reuse_cooldown_days !== null && <Badge>재사용 {p.reuse_cooldown_days}일 후</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
