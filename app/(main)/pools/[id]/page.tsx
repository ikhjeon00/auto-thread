import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PoolDetail, type PoolItemView } from "@/components/pools/pool-detail";
import type { PoolFormValue } from "@/components/pools/pool-form";
import { db } from "@/lib/db/admin";
import { poolStocks } from "@/lib/pool/pick";
import { poolItemToContent } from "@/lib/compose/schema";

export const metadata = { title: "글 창고 · AUTO THREAD" };
export const dynamic = "force-dynamic";
// AI 일괄 생성을 응답 뒤에 이어서 처리한다
export const maxDuration = 300;

const PAGE_SIZE = 100;
const STATUSES = ["pending", "available", "reserved", "used", "archived"] as const;

export default async function PoolPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const status = STATUSES.find((s) => s === sp.status) ?? null;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim().slice(0, 100) || null;

  let itemsQ = db()
    .from("pool_items")
    .select("id, text, first_reply, topic_tag, category, status, weight, source, persona_tags, created_at, media, compose", { count: "exact" })
    .eq("pool_id", id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) itemsQ = itemsQ.eq("status", status);
  if (q) itemsQ = itemsQ.ilike("text", `%${q.replace(/[%_]/g, "")}%`);

  const [poolRes, linkRes, accRes, genRes, itemsRes, bmRes, jobRes] = await Promise.all([
    db().from("content_pools").select("id, name, description, persona_filter, low_stock_days, auto_refill, refill_generator_id, reuse_cooldown_days").eq("id", id).maybeSingle(),
    db().from("pool_accounts").select("account_id").eq("pool_id", id),
    db().from("threads_accounts").select("id, username").neq("status", "disabled").order("username"),
    db().from("generators").select("id, name, kind").eq("is_active", true).order("created_at"),
    itemsQ,
    db().from("bookmarks").select("id, text, kind, created_at").order("created_at", { ascending: false }).limit(200),
    db().from("jobs").select("id").eq("type", "pool_fill").in("status", ["queued", "running"]).contains("payload", { poolId: id }).order("created_at", { ascending: false }).limit(1),
  ]);
  if (!poolRes.data) notFound();
  const pool = poolRes.data as Omit<PoolFormValue, "accountIds"> & { id: string };
  const stock = (await poolStocks([id])).get(id)!;

  return (
    <>
      <Link href="/pools" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> 글 창고
      </Link>
      <PageHeader title={pool.name} description={pool.description ?? undefined} />
      <PoolDetail
        poolId={id}
        pool={{ ...pool, accountIds: ((linkRes.data ?? []) as { account_id: string }[]).map((l) => l.account_id) }}
        stock={stock}
        accounts={(accRes.data ?? []) as { id: string; username: string }[]}
        generators={(genRes.data ?? []) as { id: string; name: string; kind: string }[]}
        items={((itemsRes.data ?? []) as (Omit<PoolItemView, "media_count" | "reply_count" | "has_link"> & { media: unknown[] | null; compose: unknown })[]).map(
          ({ media, compose, ...i }) => {
            const c = poolItemToContent({ ...i, compose });
            return {
              ...i,
              media_count: (media?.length ?? 0) || c.media.length,
              reply_count: c.replies.filter((r) => r.text.trim() || r.media).length,
              has_link: !!c.linkUrl,
            };
          },
        )}
        total={itemsRes.count ?? 0}
        page={page}
        pageCount={Math.max(1, Math.ceil((itemsRes.count ?? 0) / PAGE_SIZE))}
        filter={{ status, q }}
        bookmarks={(bmRes.data ?? []) as { id: string; text: string; kind: string }[]}
        activeJobId={(jobRes.data?.[0] as { id: string } | undefined)?.id ?? null}
      />
    </>
  );
}
