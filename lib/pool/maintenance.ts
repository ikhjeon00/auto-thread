import "server-only";
import { db } from "@/lib/db/admin";
import { enqueueJob } from "@/lib/jobs";
import { notify } from "@/lib/notify";
import { poolStocks, releasePoolItem } from "./pick";

const STALE_HOURS = 48;

/** 매일: 오래 묵은 배정 풀기, 재고 부족 알림, 자동 보충 작업 만들기 */
export async function runPoolMaintenance() {
  const result = { released: 0, lowStock: 0, refillJobs: 0 };

  // 1) 48시간 넘게 배정만 되고 쓰이지 않은 글(임시 저장을 버렸거나 다른 방식으로 바꾼 경우) 돌려놓기
  const { data: stale } = await db()
    .from("pool_items")
    .select("id")
    .eq("status", "reserved")
    .lt("reserved_at", new Date(Date.now() - STALE_HOURS * 3600_000).toISOString())
    .limit(1000);
  for (const it of (stale ?? []) as { id: string }[]) {
    const { count } = await db()
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("pool_item_id", it.id)
      .in("status", ["draft", "review", "scheduled", "processing", "failed"]);
    if (!count) {
      await releasePoolItem(it.id);
      result.released++;
    }
  }

  // 2) 재고 부족 알림 + 자동 보충
  const { data: pools } = await db().from("content_pools").select("id, name, low_stock_days, auto_refill, refill_generator_id");
  const list = (pools ?? []) as { id: string; name: string; low_stock_days: number; auto_refill: boolean; refill_generator_id: string | null }[];
  const stocks = await poolStocks(list.map((p) => p.id));
  for (const pool of list) {
    const s = stocks.get(pool.id);
    if (!s?.low) continue;
    result.lowStock++;
    await notify("warn", "stock_low", `창고 「${pool.name}」 재고 부족: 남은 글 ${s.available}개 · 약 ${s.days}일 분량 (기준 ${pool.low_stock_days}일)`, `/pools/${pool.id}`);
    if (pool.auto_refill) {
      const { count } = await db()
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("type", "pool_fill")
        .in("status", ["queued", "running"])
        .contains("payload", { poolId: pool.id });
      if (!count) {
        await enqueueJob("pool_fill", { poolId: pool.id, count: 20, generatorId: pool.refill_generator_id, autoApprove: true, auto: true }, 20);
        result.refillJobs++;
      }
    }
  }
  return result;
}
