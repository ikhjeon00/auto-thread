import "server-only";
import { db } from "@/lib/db/admin";
import { notify } from "@/lib/notify";
import { poolItemToContent, type PoolContent } from "@/lib/compose/schema";
import { eligibleItems, stockDays, weightedPick, type CandidateItem, type Persona, type PersonaFilter, type PoolRule } from "./select";

export type PickedItem = {
  id: string;
  poolId: string;
  poolName: string;
  text: string;
  first_reply: string | null;
  topic_tag: string | null;
  category: string | null;
  media: unknown;
  /** 글 작성 형태 전체(없으면 예전 간단한 글) */
  content: PoolContent;
};

type PoolRow = { id: string; name: string; persona_filter: PersonaFilter | null; reuse_cooldown_days: number | null };

async function accountPersona(accountId: string): Promise<Persona | null> {
  const { data } = await db().from("personas").select("age_group, gender, job").eq("account_id", accountId).maybeSingle();
  return (data as Persona | null) ?? null;
}

/** 이 계정의 직전 글(창고에서 온 글)의 category */
async function lastCategory(accountId: string): Promise<string | null> {
  const { data } = await db()
    .from("posts")
    .select("pool_item_id, scheduled_at")
    .eq("account_id", accountId)
    .in("status", ["scheduled", "processing", "published"])
    .not("pool_item_id", "is", null)
    .order("scheduled_at", { ascending: false })
    .limit(1);
  const itemId = (data?.[0] as { pool_item_id: string } | undefined)?.pool_item_id;
  if (!itemId) return null;
  const { data: item } = await db().from("pool_items").select("category").eq("id", itemId).maybeSingle();
  return (item?.category as string | null) ?? null;
}

export async function poolsForAccount(accountId: string): Promise<PoolRow[]> {
  const { data } = await db()
    .from("pool_accounts")
    .select("content_pools(id, name, persona_filter, reuse_cooldown_days)")
    .eq("account_id", accountId);
  return ((data ?? []) as unknown as { content_pools: PoolRow | null }[]).map((r) => r.content_pools).filter((p): p is PoolRow => !!p);
}

export type PickResult = { item: PickedItem } | { item: null; reason: string };

/**
 * 계정에 맞는 창고 글을 하나 골라 reserved 로 잡는다.
 * 배정은 "지금도 available 일 때만 reserved 로 바꾸기"(조건부 업데이트)라 동시에 같은 글을 가져가지 못한다.
 */
export async function pickPoolItem(accountId: string, opts: { poolId?: string | null; excludeIds?: string[]; notifyEmpty?: boolean } = {}): Promise<PickResult> {
  let pools = await poolsForAccount(accountId);
  if (opts.poolId) pools = pools.filter((p) => p.id === opts.poolId);
  if (!pools.length) return { item: null, reason: opts.poolId ? "이 계정에 연결된 창고가 아닙니다." : "이 계정에 연결된 창고가 없습니다." };

  const [persona, lastCat] = await Promise.all([accountPersona(accountId), lastCategory(accountId)]);
  const poolIds = pools.map((p) => p.id);
  const { data: items, error } = await db()
    .from("pool_items")
    .select("id, pool_id, category, weight, persona_tags")
    .in("pool_id", poolIds)
    .eq("status", "available")
    .limit(5000);
  if (error) throw new Error(error.message);
  const ids = (items ?? []).map((i) => i.id as string).filter((id) => !opts.excludeIds?.includes(id));
  const usages = new Map<string, { accountId: string; usedAt: string }[]>();
  for (let k = 0; k < ids.length; k += 500) {
    const { data: us } = await db().from("pool_item_usage").select("item_id, account_id, used_at").in("item_id", ids.slice(k, k + 500));
    for (const u of (us ?? []) as { item_id: string; account_id: string; used_at: string }[]) {
      usages.set(u.item_id, [...(usages.get(u.item_id) ?? []), { accountId: u.account_id, usedAt: u.used_at }]);
    }
  }

  const candidates: CandidateItem[] = (items ?? [])
    .filter((i) => ids.includes(i.id as string))
    .map((i) => ({
      id: i.id as string,
      poolId: i.pool_id as string,
      category: (i.category as string | null) ?? null,
      weight: (i.weight as number) ?? 1,
      personaTags: (i.persona_tags as string[]) ?? [],
      usages: usages.get(i.id as string) ?? [],
    }));
  const rules = new Map<string, PoolRule>(pools.map((p) => [p.id, { id: p.id, personaFilter: p.persona_filter ?? {}, reuseCooldownDays: p.reuse_cooldown_days }]));
  let eligible = eligibleItems(candidates, { accountId, persona, lastCategory: lastCat, pools: rules, now: Date.now() });

  // 다른 곳에서 먼저 가져가면 다음 후보로 (최대 5번)
  for (let attempt = 0; attempt < 5 && eligible.length; attempt++) {
    const pick = weightedPick(eligible)!;
    const { data: reserved } = await db()
      .from("pool_items")
      .update({ status: "reserved", reserved_at: new Date().toISOString(), reserved_account_id: accountId })
      .eq("id", pick.id)
      .eq("status", "available")
      .select("id, pool_id, text, first_reply, topic_tag, category, media, compose");
    if (reserved?.length) {
      const r = reserved[0];
      return {
        item: {
          id: r.id as string,
          poolId: r.pool_id as string,
          poolName: pools.find((p) => p.id === r.pool_id)?.name ?? "",
          text: r.text as string,
          first_reply: r.first_reply as string | null,
          topic_tag: r.topic_tag as string | null,
          category: r.category as string | null,
          media: r.media,
          content: poolItemToContent(r as { text: string; first_reply: string | null; topic_tag: string | null; compose: unknown }),
        },
      };
    }
    eligible = eligible.filter((e) => e.id !== pick.id);
  }

  const reason = "조건에 맞는 창고 글이 없습니다(재고 소진, 재사용 금지, 직전 글과 같은 분류 등).";
  if (opts.notifyEmpty) {
    const { data: acc } = await db().from("threads_accounts").select("username").eq("id", accountId).maybeSingle();
    await notify("warn", "stock_empty", `@${acc?.username ?? "계정"}: ${reason}`, "/pools");
  }
  return { item: null, reason };
}

/** 배정 해제(예약 취소·다른 글 뽑기) */
export async function releasePoolItem(itemId: string): Promise<void> {
  await db().from("pool_items").update({ status: "available", reserved_at: null, reserved_account_id: null }).eq("id", itemId).eq("status", "reserved");
}

/** 발행되면 사용 기록. 재사용 금지 기간이 없으면 used, 있으면 다시 available(기간 동안은 선택 규칙이 막는다) */
export async function markPoolItemUsed(itemId: string, accountId: string, postId: string): Promise<void> {
  const { data: item } = await db().from("pool_items").select("pool_id, content_pools(reuse_cooldown_days)").eq("id", itemId).maybeSingle();
  if (!item) return;
  const cooldown = (item.content_pools as unknown as { reuse_cooldown_days: number | null } | null)?.reuse_cooldown_days ?? null;
  await db().from("pool_item_usage").insert({ item_id: itemId, account_id: accountId, post_id: postId, used_at: new Date().toISOString() });
  await db()
    .from("pool_items")
    .update({ status: cooldown === null ? "used" : "available", reserved_at: null, reserved_account_id: null })
    .eq("id", itemId);
}

export type PoolStock = { poolId: string; available: number; pending: number; reserved: number; used: number; archived: number; dailyNeed: number; days: number | null; low: boolean };

/**
 * 재고: "남은 글 N개 · 약 N일 분량"
 * 하루 소비량 = 이 창고를 쓰는 진행 중 캠페인의 하루 게시 수 합 → 없으면 최근 7일 평균 사용량 → 없으면 연결 계정 수(하루 1개씩)
 */
export async function poolStocks(poolIds: string[]): Promise<Map<string, PoolStock>> {
  const out = new Map<string, PoolStock>();
  if (!poolIds.length) return out;
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [itemsRes, campRes, usageRes, linkRes, poolRes] = await Promise.all([
    db().from("pool_items").select("pool_id, status").in("pool_id", poolIds).limit(50000),
    db().from("campaigns").select("pool_id, daily_count").in("pool_id", poolIds).eq("status", "active"),
    db().from("pool_item_usage").select("pool_items!inner(pool_id)").gte("used_at", since).in("pool_items.pool_id", poolIds).limit(50000),
    db().from("pool_accounts").select("pool_id").in("pool_id", poolIds),
    db().from("content_pools").select("id, low_stock_days").in("id", poolIds),
  ]);
  for (const id of poolIds) {
    const counts = { available: 0, pending: 0, reserved: 0, used: 0, archived: 0 };
    for (const i of (itemsRes.data ?? []) as { pool_id: string; status: keyof typeof counts }[]) if (i.pool_id === id) counts[i.status]++;
    const camp = ((campRes.data ?? []) as { pool_id: string; daily_count: number }[]).filter((c) => c.pool_id === id).reduce((s, c) => s + c.daily_count, 0);
    const used7 = ((usageRes.data ?? []) as unknown as { pool_items: { pool_id: string } }[]).filter((u) => u.pool_items?.pool_id === id).length;
    const links = ((linkRes.data ?? []) as { pool_id: string }[]).filter((l) => l.pool_id === id).length;
    const dailyNeed = camp || (used7 ? Math.ceil(used7 / 7) : links);
    const days = stockDays(counts.available, dailyNeed);
    const lowDays = ((poolRes.data ?? []) as { id: string; low_stock_days: number }[]).find((p) => p.id === id)?.low_stock_days ?? 3;
    out.set(id, { poolId: id, ...counts, dailyNeed, days, low: days !== null && days < lowDays });
  }
  return out;
}

/**
 * 뽑기 + 후보가 없을 때 설정(pool_empty_behavior)에 따라 건너뛰기 또는 AI 즉석 생성.
 * 어느 쪽이든 활동 알림을 남긴다.
 */
export async function pickOrGenerate(accountId: string, opts: { poolId?: string | null; excludeIds?: string[] } = {}): Promise<PickResult & { generated?: boolean }> {
  const r = await pickPoolItem(accountId, { ...opts, notifyEmpty: false });
  if (r.item) return r;
  const { getSettings } = await import("@/lib/settings");
  const settings = await getSettings();
  const { data: acc } = await db().from("threads_accounts").select("username").eq("id", accountId).maybeSingle();
  const who = `@${acc?.username ?? "계정"}`;
  if (settings.poolEmptyBehavior !== "ai_generate") {
    await notify("warn", "stock_empty", `${who}: ${r.reason} (설정: 건너뛰기)`, "/pools");
    return r;
  }
  const pools = (await poolsForAccount(accountId)).filter((p) => !opts.poolId || p.id === opts.poolId);
  if (!pools.length) return r;
  const { generatePosts } = await import("@/lib/ai/generate");
  const g = await generatePosts({ accountId, kind: "general", count: 1, purpose: "pool" });
  const post = g.posts.find((x) => !x.issues.length) ?? g.posts[0];
  if (!post) return r;
  const { data, error } = await db()
    .from("pool_items")
    .insert({
      pool_id: pools[0].id,
      text: post.text,
      first_reply: post.first_reply || null,
      topic_tag: post.topic_tag || null,
      category: post.category || null,
      status: "reserved",
      reserved_at: new Date().toISOString(),
      reserved_account_id: accountId,
      source: "ai",
    })
    .select("id, pool_id, text, first_reply, topic_tag, category, media, compose")
    .single();
  if (error) throw new Error(error.message);
  await notify("warn", "stock_empty", `${who}: 창고 글이 없어 AI로 즉석 생성했습니다(창고 「${pools[0].name}」).`, `/pools/${pools[0].id}`);
  return {
    generated: true,
    item: {
      id: data.id as string,
      poolId: data.pool_id as string,
      poolName: pools[0].name,
      text: data.text as string,
      first_reply: data.first_reply as string | null,
      topic_tag: data.topic_tag as string | null,
      category: data.category as string | null,
      media: data.media,
      content: poolItemToContent(data as { text: string; first_reply: string | null; topic_tag: string | null; compose: unknown }),
    },
  };
}
