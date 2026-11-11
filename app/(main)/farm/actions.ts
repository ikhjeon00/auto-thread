"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require";
import { db } from "@/lib/db/admin";
import { env } from "@/lib/env";
import { enqueueJob, runJobs } from "@/lib/jobs";
import { mediaItemSchema } from "@/lib/compose/schema";
import { releasePoolItem } from "@/lib/pool/pick";
import type { FarmConfig } from "@/lib/farm/types";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" / ") : e instanceof Error ? e.message : String(e),
});
const uuid = z.string().uuid();
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간 형식은 HH:MM 입니다.");

function refresh() {
  revalidatePath("/farm/growth");
  revalidatePath("/farm/monetize");
  revalidatePath("/scheduled");
}

function kickJobs() {
  after(async () => {
    try {
      await runJobs(Date.now() + 280_000, 1);
    } catch (e) {
      console.error("[farm] 작업 실행 실패", e);
    }
  });
}

// ---------------------------------------------------------------- 농장 만들기

const farmInput = z
  .object({
    kind: z.enum(["growth", "monetize"]),
    accounts: z
      .array(z.object({ id: uuid, generalCount: z.coerce.number().int().min(0).max(30), productCount: z.coerce.number().int().min(0).max(30) }))
      .min(1, "계정을 하나 이상 고르세요.")
      .max(50),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "시작일을 고르세요."),
    days: z.coerce.number().int().min(1, "기간은 1~30일입니다.").max(30, "기간은 1~30일입니다."),
    activeStart: hm,
    activeEnd: hm,
    generalSource: z.enum(["ai", "pool"]),
    poolId: uuid.nullable(),
    assignTiming: z.enum(["pre", "at_publish"]),
    generatorId: uuid.nullable(),
    productGeneratorId: uuid.nullable(),
    productIds: z.array(uuid).max(50),
    useVision: z.boolean(),
    isAiLabel: z.boolean(),
    mode: z.enum(["review", "auto"]),
  })
  .refine((v) => v.activeStart < v.activeEnd, { message: "활동 시작 시간이 끝 시간보다 빨라야 합니다." })
  .refine((v) => v.accounts.some((a) => a.generalCount + a.productCount > 0), { message: "하루 게시 수가 모두 0입니다." })
  .refine((v) => v.kind === "growth" || (v.productIds.length > 0 && v.accounts.some((a) => a.productCount > 0)), {
    message: "수익화 농장은 상품을 하나 이상 고르고 하루 상품글 수를 정하세요.",
  });
export type FarmInput = z.input<typeof farmInput>;

export async function createFarmAction(input: FarmInput): Promise<Result<{ batchId: string; jobId: string }>> {
  try {
    await requireSession();
    const v = farmInput.parse(input);
    const { data: accs } = await db().from("threads_accounts").select("id, username, status").in("id", v.accounts.map((a) => a.id));
    const bad = ((accs ?? []) as { username: string; status: string }[]).filter((a) => a.status !== "active");
    if (bad.length) throw new Error(`재연결이 필요한 계정이 있습니다: ${bad.map((a) => `@${a.username}`).join(", ")}`);

    const batchId = randomUUID();
    const jobId = await enqueueJob("farm_build", { batchId, kind: v.kind }, 0);
    const rows = v.accounts
      .filter((a) => a.generalCount + a.productCount > 0)
      .map((a) => {
        const generalCount = a.generalCount;
        const productCount = v.kind === "monetize" ? a.productCount : 0;
        const config: FarmConfig = {
          kind: v.kind,
          dailyGeneralCount: generalCount,
          dailyProductCount: productCount,
          generalSource: v.generalSource,
          poolId: v.poolId,
          assignTiming: v.assignTiming,
          generatorId: v.generatorId,
          productGeneratorId: v.productGeneratorId,
          productIds: v.kind === "monetize" ? v.productIds : [],
          useVision: v.useVision,
          isAiLabel: v.isAiLabel,
          mode: v.mode,
          phase: "slots",
        };
        const total = generalCount + productCount;
        return {
          account_id: a.id,
          kind: v.kind,
          start_date: v.startDate,
          days: v.days,
          daily_count: total,
          active_start: v.activeStart,
          active_end: v.activeEnd,
          content_source: v.generalSource,
          assign_timing: v.assignTiming,
          pool_id: v.generalSource === "pool" ? v.poolId : null,
          product_ids: config.productIds,
          daily_mix_ratio: total ? Math.round((productCount / total) * 1000) / 1000 : null,
          mode: v.mode,
          status: "draft",
          batch_id: batchId,
          job_id: jobId,
          config,
        };
      });
    const { error } = await db().from("campaigns").insert(rows);
    if (error) throw new Error(error.message);
    kickJobs();
    refresh();
    return { ok: true, data: { batchId, jobId } };
  } catch (e) {
    return fail(e);
  }
}

async function batchCampaignIds(batchId: string): Promise<string[]> {
  const { data } = await db().from("campaigns").select("id").eq("batch_id", uuid.parse(batchId));
  return ((data ?? []) as { id: string }[]).map((c) => c.id);
}

/** 검토 모드: 확인한 글을 예약으로 확정(지난 시간 글은 빼고 알려 준다) */
export async function confirmBatchAction(batchId: string, postIds?: string[]): Promise<Result<{ confirmed: number; past: number }>> {
  try {
    await requireSession();
    const ids = await batchCampaignIds(batchId);
    if (!ids.length) throw new Error("캠페인을 찾을 수 없습니다.");
    const now = new Date().toISOString();
    let q = db().from("posts").update({ status: "scheduled" }).in("campaign_id", ids).eq("status", "review").gt("scheduled_at", now);
    if (postIds?.length) q = q.in("id", z.array(uuid).max(5000).parse(postIds));
    const { data, error } = await q.select("id");
    if (error) throw new Error(error.message);
    const { count: past } = await db().from("posts").select("id", { count: "exact", head: true }).in("campaign_id", ids).eq("status", "review").lte("scheduled_at", now);
    refresh();
    revalidatePath(`/farm/batch/${batchId}`);
    return { ok: true, data: { confirmed: data?.length ?? 0, past: past ?? 0 } };
  } catch (e) {
    return fail(e);
  }
}

/** 농장 글 취소(창고에서 온 글은 되돌림) */
export async function cancelFarmPostsAction(batchId: string, postIds: string[] | null): Promise<Result<{ cancelled: number }>> {
  try {
    await requireSession();
    const ids = await batchCampaignIds(batchId);
    let q = db().from("posts").update({ status: "cancelled", next_attempt_at: null }).in("campaign_id", ids).in("status", ["draft", "review", "scheduled", "failed"]);
    if (postIds) q = q.in("id", z.array(uuid).max(5000).parse(postIds));
    const { data, error } = await q.select("id, pool_item_id");
    if (error) throw new Error(error.message);
    for (const p of (data ?? []) as { pool_item_id: string | null }[]) if (p.pool_item_id) await releasePoolItem(p.pool_item_id);
    if (!postIds) {
      await db().from("campaigns").update({ status: "cancelled" }).in("id", ids);
      const { data: camp } = await db().from("campaigns").select("job_id").in("id", ids).limit(1);
      const jobId = (camp?.[0] as { job_id: string | null } | undefined)?.job_id;
      if (jobId) await db().from("jobs").update({ status: "failed", error: "사용자가 취소함" }).eq("id", jobId).in("status", ["queued", "running"]);
    }
    refresh();
    revalidatePath(`/farm/batch/${batchId}`);
    return { ok: true, data: { cancelled: data?.length ?? 0 } };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- 상품

const productInput = z.object({
  name: z.string().trim().min(1, "상품명을 입력하세요.").max(100),
  affiliate_url: z.string().trim().url("제휴 링크가 올바른 주소가 아닙니다.").max(2000),
  disclosure_id: uuid.nullable(),
  media: z.array(mediaItemSchema).max(20),
  memo: z.string().trim().max(1000).nullable(),
  is_active: z.boolean(),
});
export type ProductInput = z.input<typeof productInput>;

export async function saveProductAction(id: string | null, input: ProductInput): Promise<Result<{ id: string }>> {
  try {
    await requireSession();
    const v = productInput.parse(input);
    const row = { ...v, memo: v.memo || null, media_paths: v.media.map((m) => m.storagePath) };
    if (id) {
      const { error } = await db().from("products").update(row).eq("id", uuid.parse(id));
      if (error) throw new Error(error.message);
      refresh();
      return { ok: true, data: { id } };
    }
    const { data, error } = await db().from("products").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, data: { id: data.id as string } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteProductAction(id: string): Promise<Result> {
  try {
    await requireSession();
    const { error } = await db().from("products").delete().eq("id", uuid.parse(id));
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- 자료실

const bundleInput = z.object({
  name: z.string().trim().min(1, "묶음 이름을 입력하세요.").max(100),
  category: z.string().trim().max(30).nullable().transform((v) => v || null),
  memo: z.string().trim().max(1000).nullable().transform((v) => v || null),
});

export async function saveBundleAction(id: string | null, input: z.input<typeof bundleInput>): Promise<Result<{ id: string }>> {
  try {
    await requireSession();
    const v = bundleInput.parse(input);
    if (id) {
      const { error } = await db().from("asset_bundles").update(v).eq("id", uuid.parse(id));
      if (error) throw new Error(error.message);
      revalidatePath("/assets");
      return { ok: true, data: { id } };
    }
    const { data, error } = await db().from("asset_bundles").insert(v).select("id").single();
    if (error) throw new Error(error.message);
    revalidatePath("/assets");
    return { ok: true, data: { id: data.id as string } };
  } catch (e) {
    return fail(e);
  }
}

/** 묶음의 사진·영상 목록을 통째로 저장(추가·삭제·순서 변경). 빠진 파일은 저장소에서도 지운다 */
export async function setBundleAssetsAction(bundleId: string, media: z.input<typeof mediaItemSchema>[]): Promise<Result> {
  try {
    await requireSession();
    const bid = uuid.parse(bundleId);
    const list = z.array(mediaItemSchema).max(200).parse(media);
    const { data: old } = await db().from("assets").select("storage_path").eq("bundle_id", bid);
    const keep = new Set(list.map((m) => m.storagePath));
    const removed = ((old ?? []) as { storage_path: string }[]).map((o) => o.storage_path).filter((p) => !keep.has(p));
    await db().from("assets").delete().eq("bundle_id", bid);
    if (list.length) {
      const { error } = await db()
        .from("assets")
        .insert(list.map((m, i) => ({ bundle_id: bid, storage_path: m.storagePath, media_type: m.mediaType, width: m.width ?? null, height: m.height ?? null, sort_order: i })));
      if (error) throw new Error(error.message);
    }
    if (removed.length) await db().storage.from(env().STORAGE_BUCKET).remove(removed.filter((p) => p.startsWith("assets/")));
    revalidatePath("/assets");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBundleAction(id: string): Promise<Result> {
  try {
    await requireSession();
    const bid = uuid.parse(id);
    const { data: files } = await db().from("assets").select("storage_path").eq("bundle_id", bid);
    const { error } = await db().from("asset_bundles").delete().eq("id", bid);
    if (error) throw new Error(error.message);
    const paths = ((files ?? []) as { storage_path: string }[]).map((f) => f.storage_path).filter((p) => p.startsWith("assets/"));
    // 다른 곳(창고 글·예약 글)에서 같은 파일을 쓰고 있을 수 있으니, 글에 쓰이지 않은 파일만 지운다
    if (paths.length) {
      const { data: used } = await db().from("post_media").select("storage_path").in("storage_path", paths);
      const usedSet = new Set(((used ?? []) as { storage_path: string }[]).map((u) => u.storage_path));
      const free = paths.filter((p) => !usedSet.has(p));
      if (free.length) await db().storage.from(env().STORAGE_BUCKET).remove(free);
    }
    revalidatePath("/assets");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export type BundleView = { id: string; name: string; category: string | null; memo: string | null; media: z.output<typeof mediaItemSchema>[] };

/** 자료실 고르기 창에서 쓰는 목록 */
export async function listBundlesAction(q?: string): Promise<Result<BundleView[]>> {
  try {
    await requireSession();
    let query = db().from("asset_bundles").select("id, name, category, memo, assets(storage_path, media_type, width, height, sort_order)").order("created_at", { ascending: false }).limit(100);
    if (q?.trim()) query = query.ilike("name", `%${q.trim().replace(/[%_]/g, "")}%`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true, data: ((data ?? []) as unknown as BundleRow[]).map(toBundleView) };
  } catch (e) {
    return fail(e);
  }
}

type BundleRow = {
  id: string;
  name: string;
  category: string | null;
  memo: string | null;
  assets: { storage_path: string; media_type: "image" | "video"; width: number | null; height: number | null; sort_order: number }[];
};

function publicUrl(path: string): string {
  return db().storage.from(env().STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

function toBundleView(b: BundleRow): BundleView {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    memo: b.memo,
    media: [...b.assets]
      .sort((x, y) => x.sort_order - y.sort_order)
      .map((a) => ({ storagePath: a.storage_path, publicUrl: publicUrl(a.storage_path), mediaType: a.media_type, width: a.width, height: a.height })),
  };
}
