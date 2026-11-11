import "server-only";
import { db } from "@/lib/db/admin";
import { generatePosts } from "@/lib/ai/generate";
import type { GeneratedPost } from "@/lib/ai/validate";
import { kstRange } from "@/lib/calendar";
import { addDays } from "@/lib/calendar";
import { savePost } from "@/lib/compose/save";
import { emptyCompose, type ComposeInput, type MediaItem } from "@/lib/compose/schema";
import { JobContinue, registerJob, type JobContext } from "@/lib/jobs";
import { pickOrGenerate } from "@/lib/pool/pick";
import { getSettings } from "@/lib/settings";
import { planSlots, type PlanAccount } from "@/lib/scheduler/slots";
import { fromZonedTime } from "date-fns-tz";
import { APP_TZ } from "@/lib/time";
import type { FarmConfig, FarmPostMeta } from "./types";

type CampaignRow = {
  id: string;
  account_id: string;
  kind: string;
  start_date: string;
  days: number;
  daily_count: number;
  active_start: string;
  active_end: string;
  pool_id: string | null;
  mode: "review" | "auto";
  status: string;
  config: FarmConfig;
};

type ProductRow = { id: string; name: string; affiliate_url: string; disclosure_id: string | null; media: MediaItem[]; memo: string | null };

const hm = (t: string) => t.slice(0, 5);
const toEpoch = (day: string, time: string) => fromZonedTime(`${day}T${hm(time)}:00`, APP_TZ).getTime();

/** 생성 결과 중 그대로 내보내면 안 되는 문제(길이·금칙어 등)가 있는 글은 빼고, 비슷함 경고만 있는 글은 쓴다 */
const usable = (p: GeneratedPost) => p.text && !p.issues.some((i) => /초과|금칙어|해시태그|비어/.test(i));

async function loadCampaigns(batchId: string): Promise<CampaignRow[]> {
  const { data, error } = await db()
    .from("campaigns")
    .select("id, account_id, kind, start_date, days, daily_count, active_start, active_end, pool_id, mode, status, config")
    .eq("batch_id", batchId);
  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignRow[];
}

// ------------------------------------------------------------------ 1단계: 시간 배치 + 자리 잡기

async function placeSlots(campaigns: CampaignRow[]) {
  const settings = await getSettings();
  const cfg0 = campaigns[0].config;
  const days = Array.from({ length: campaigns[0].days }, (_, i) => addDays(campaigns[0].start_date, i));
  const { start, end } = kstRange(days[0], days[days.length - 1]);

  const { data: existing } = await db()
    .from("posts")
    .select("id, account_id, scheduled_at")
    .in("status", ["scheduled", "processing", "review", "published"])
    .gte("scheduled_at", start)
    .lt("scheduled_at", end)
    .limit(20000);
  const { data: accRows } = await db().from("threads_accounts").select("id, daily_post_limit").in("id", campaigns.map((c) => c.account_id));
  const limitOf = new Map(((accRows ?? []) as { id: string; daily_post_limit: number }[]).map((a) => [a.id, a.daily_post_limit]));

  const existingCounts = new Map<string, number>();
  const slotsExisting = ((existing ?? []) as { id: string; account_id: string; scheduled_at: string }[]).map((p) => {
    const day = new Date(Date.parse(p.scheduled_at) + 9 * 3600_000).toISOString().slice(0, 10);
    existingCounts.set(`${p.account_id}|${day}`, (existingCounts.get(`${p.account_id}|${day}`) ?? 0) + 1);
    existingCounts.set(`*|${day}`, (existingCounts.get(`*|${day}`) ?? 0) + 1);
    return { id: p.id, accountId: p.account_id, at: Date.parse(p.scheduled_at) };
  });

  const accounts: PlanAccount[] = campaigns.map((c) => ({
    id: c.account_id,
    dailyCount: c.config.dailyGeneralCount + c.config.dailyProductCount,
    dailyLimit: limitOf.get(c.account_id) ?? settings.defaultDailyPostLimit,
  }));
  const plan = planSlots({
    days,
    accounts,
    activeStart: hm(campaigns[0].active_start),
    activeEnd: hm(campaigns[0].active_end),
    toEpoch,
    existing: slotsExisting,
    existingCounts,
    minGapMinutes: settings.minGapMinutes,
    sameAccountGapMinutes: settings.sameAccountGapMinutes,
    globalDailyLimit: settings.globalDailyLimit,
    notBefore: Date.now() + 10 * 60_000,
  });

  // 계정·날짜마다 상품글/일상글을 섞고, 상품은 시간순으로 돌아가며 배정
  const rows: Record<string, unknown>[] = [];
  let productIdx = 0;
  for (const c of campaigns) {
    const byDay = new Map<string, number[]>();
    for (const s of plan.slots.filter((x) => x.accountId === c.account_id)) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s.at]);
    for (const [, times] of byDay) {
      const p = Math.min(c.config.dailyProductCount, times.length);
      const kinds: ("product" | "general")[] = [...Array(p).fill("product"), ...Array(times.length - p).fill("general")];
      for (let i = kinds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
      }
      times.forEach((at, i) => {
        const type = kinds[i];
        const productId = type === "product" && c.config.productIds.length ? c.config.productIds[productIdx++ % c.config.productIds.length] : null;
        const meta: FarmPostMeta = { type, productId };
        rows.push({
          account_id: c.account_id,
          campaign_id: c.id,
          kind: type === "product" ? "product" : "general",
          status: "draft",
          text: "",
          scheduled_at: new Date(at).toISOString(),
          ai_meta: { farm: meta },
        });
      });
    }
  }
  rows.sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
  for (let k = 0; k < rows.length; k += 500) {
    const { error } = await db().from("posts").insert(rows.slice(k, k + 500));
    if (error) throw new Error(error.message);
  }
  for (const c of campaigns) {
    const skipped = plan.skipped.filter((s) => s.accountId === c.account_id).length;
    await db()
      .from("campaigns")
      .update({ status: "active", config: { ...c.config, phase: "fill", skipped } })
      .eq("id", c.id);
  }
  void cfg0;
  return { placed: rows.length, skipped: plan.skipped.length };
}

// ------------------------------------------------------------------ 2단계: 내용 채우기

type Placeholder = { id: string; account_id: string; campaign_id: string; scheduled_at: string; ai_meta: { farm: FarmPostMeta } };

async function finalize(ph: Placeholder, c: CampaignRow, input: Omit<ComposeInput, "accountId">, extraMeta: Partial<FarmPostMeta> = {}) {
  const compose: ComposeInput = { ...input, accountId: ph.account_id };
  const meta = { farm: { ...ph.ai_meta.farm, ...extraMeta } };
  const want = c.mode === "auto" ? "scheduled" : "review";
  try {
    await savePost(compose, { postId: ph.id, status: want, scheduledAt: new Date(ph.scheduled_at) });
  } catch (e) {
    // 자동 모드에서 검사에 걸리면 검토 대기로 돌려 사람이 고치게 한다
    await savePost(compose, { postId: ph.id, status: "draft", scheduledAt: new Date(ph.scheduled_at) }).catch(() => {});
    const msg =
      e && typeof e === "object" && "issues" in e && Array.isArray((e as { issues: unknown[] }).issues)
        ? (e as { issues: { path: unknown[]; message: string }[] }).issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" / ")
        : e instanceof Error
          ? e.message
          : String(e);
    await db().from("posts").update({ status: "review", last_error: msg }).eq("id", ph.id);
  }
  await db().from("posts").update({ campaign_id: c.id, ai_meta: meta }).eq("id", ph.id);
}

async function fillPlaceholders(campaigns: CampaignRow[], ctx: JobContext) {
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const { data } = await db()
    .from("posts")
    .select("id, account_id, campaign_id, scheduled_at, ai_meta")
    .in("campaign_id", [...byId.keys()])
    .eq("status", "draft")
    .eq("text", "")
    .order("scheduled_at")
    .limit(2000);
  const placeholders = (data ?? []) as Placeholder[];
  const { count: totalCount } = await db().from("posts").select("id", { count: "exact", head: true }).in("campaign_id", [...byId.keys()]);
  const total = totalCount ?? placeholders.length;
  let done = total - placeholders.length;
  await ctx.progress(done, total);

  const productIds = [...new Set(placeholders.map((p) => p.ai_meta.farm.productId).filter(Boolean) as string[])];
  const products = new Map<string, ProductRow>();
  if (productIds.length) {
    const { data: pr } = await db().from("products").select("id, name, affiliate_url, disclosure_id, media, memo").in("id", productIds);
    for (const p of (pr ?? []) as ProductRow[]) products.set(p.id, p);
  }
  const { data: defDisc } = await db().from("disclosures").select("id").eq("is_default", true).maybeSingle();

  // (계정, 종류, 상품)별로 묶어 한 번에 만든다
  const groups = new Map<string, Placeholder[]>();
  for (const p of placeholders) {
    const f = p.ai_meta.farm;
    const key = `${p.account_id}|${f.type}|${f.productId ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  for (const [, group] of groups) {
    if (Date.now() > ctx.deadline - 60_000) return new JobContinue("시간 부족");
    const first = group[0];
    const c = byId.get(first.campaign_id)!;
    const f = first.ai_meta.farm;
    const cfg = c.config;

    if (f.type === "general" && cfg.generalSource === "pool") {
      for (const ph of group) {
        if (Date.now() > ctx.deadline - 30_000) return new JobContinue("시간 부족");
        if (cfg.assignTiming === "at_publish") {
          // 발행 직전에 창고에서 뽑는다. 지금은 자리만 확정
          await db()
            .from("posts")
            .update({ status: c.mode === "auto" ? "scheduled" : "review", ai_meta: { farm: { ...ph.ai_meta.farm, pickAtPublish: true } } })
            .eq("id", ph.id);
        } else {
          const r = await pickOrGenerate(ph.account_id, { poolId: cfg.poolId });
          if (!r.item) {
            await db().from("posts").update({ status: "cancelled", last_error: r.reason }).eq("id", ph.id);
          } else {
            await finalize(ph, c, { ...r.item.content, mode: "pool", poolItemId: r.item.id, isAiLabel: r.item.content.isAiLabel || cfg.isAiLabel });
          }
        }
        await ctx.progress(++done, total);
      }
      continue;
    }

    // AI 생성(일상글 또는 상품글): 20개씩
    const product = f.productId ? products.get(f.productId) : undefined;
    for (let k = 0; k < group.length; k += 20) {
      if (Date.now() > ctx.deadline - 60_000) return new JobContinue("시간 부족");
      const chunk = group.slice(k, k + 20);
      const gen = await generatePosts({
        accountId: first.account_id,
        kind: f.type === "product" ? "product" : "general",
        generatorId: f.type === "product" ? cfg.productGeneratorId : cfg.generatorId,
        topic: product ? `${product.name}${product.memo ? `\n특징: ${product.memo}` : ""}` : null,
        images:
          product && cfg.useVision
            ? product.media
                .filter((m) => m.mediaType === "image")
                .slice(0, 3)
                .map((m) => ({ url: m.publicUrl }))
            : undefined,
        count: chunk.length,
        purpose: "farm",
        jobId: ctx.job.id,
      });
      const good = gen.posts.filter(usable);
      for (let i = 0; i < chunk.length && i < good.length; i++) {
        const ph = chunk[i];
        const g = good[i];
        const base = emptyCompose();
        const content: Omit<ComposeInput, "accountId"> =
          f.type === "product" && product
            ? {
                ...base,
                kind: "product",
                text: g.text,
                media: product.media.slice(0, 20),
                replies: g.first_reply ? [{ text: g.first_reply, media: null }] : [],
                firstReplyMainMedia: product.media.length > 0,
                linkUrl: product.affiliate_url,
                linkPosition: "first_reply",
                disclosureId: product.disclosure_id ?? (defDisc?.id as string | undefined) ?? null,
                topicTag: g.topic_tag || null,
                isAiLabel: cfg.isAiLabel,
                mode: "ai",
                generatorId: gen.meta.generatorId,
              }
            : {
                ...base,
                kind: "general",
                text: g.text,
                replies: g.first_reply ? [{ text: g.first_reply, media: null }] : [],
                topicTag: g.topic_tag || null,
                isAiLabel: cfg.isAiLabel,
                mode: "ai",
                generatorId: gen.meta.generatorId,
              };
        await finalize(ph, c, content, g.issues.length ? { issues: g.issues } : {});
        await ctx.progress(++done, total);
      }
      // 모자란 자리는 다음 실행에서 다시 만든다
      if (good.length < chunk.length) return new JobContinue("검사 통과 글 부족");
    }
  }
  return null;
}

registerJob("farm_build", async (ctx) => {
  const { batchId } = ctx.job.payload as { batchId: string };
  const campaigns = await loadCampaigns(batchId);
  if (!campaigns.length) throw new Error("캠페인이 없습니다(취소되었을 수 있음).");
  if (campaigns.every((c) => c.status === "cancelled")) return { cancelled: true };

  let placed: { placed: number; skipped: number } | null = null;
  if (campaigns.some((c) => c.config.phase === "slots")) {
    placed = await placeSlots(campaigns);
    if (Date.now() > ctx.deadline - 60_000) return new JobContinue("배치 완료, 채우기 남음");
  }
  const fresh = await loadCampaigns(batchId);
  const cont = await fillPlaceholders(fresh.filter((c) => c.status !== "cancelled"), ctx);
  if (cont) return cont;

  for (const c of fresh) await db().from("campaigns").update({ config: { ...c.config, phase: "done" } }).eq("id", c.id);
  const { count } = await db().from("posts").select("id", { count: "exact", head: true }).in("campaign_id", fresh.map((c) => c.id)).in("status", ["review", "scheduled"]);
  const skipped = fresh.reduce((s, c) => s + (c.config.skipped ?? 0), 0);
  return { posts: count ?? 0, skipped, ...(placed ? { placed: placed.placed } : {}) };
});
