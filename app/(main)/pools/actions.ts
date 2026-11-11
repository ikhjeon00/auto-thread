"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require";
import { db } from "@/lib/db/admin";
import { enqueueJob, runJobs } from "@/lib/jobs";
import { buildPlan, hasErrors } from "@/lib/compose/plan";
import { emptyCompose, mediaItemSchema, poolContentSchema, poolItemToContent } from "@/lib/compose/schema";
import { CSV_MAX_IMAGES } from "@/lib/csv-images";
import { loadDisclosure } from "@/lib/compose/save";
import { getSettings } from "@/lib/settings";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" / ") : e instanceof Error ? e.message : String(e),
});
const uuid = z.string().uuid();

function refresh(poolId?: string) {
  revalidatePath("/pools");
  if (poolId) revalidatePath(`/pools/${poolId}`);
}

// ---------------------------------------------------------------- 창고

const personaFilter = z.object({
  age_group: z.enum(["20s", "30s", "40s_early", "40s_late", "any"]).nullable().optional(),
  gender: z.enum(["male", "female", "any"]).nullable().optional(),
  job: z.enum(["office", "self_employed", "business", "homemaker", "any"]).nullable().optional(),
});

const poolInput = z.object({
  name: z.string().trim().min(1, "창고 이름을 입력하세요.").max(50),
  description: z.string().trim().max(500).nullable(),
  accountIds: z.array(uuid).max(50),
  persona_filter: personaFilter,
  low_stock_days: z.coerce.number().int().min(0).max(60),
  auto_refill: z.boolean(),
  refill_generator_id: uuid.nullable(),
  reuse_cooldown_days: z.coerce.number().int().min(1).max(3650).nullable(),
});
export type PoolInput = z.input<typeof poolInput>;

export async function savePoolAction(id: string | null, input: PoolInput): Promise<Result<{ id: string }>> {
  try {
    await requireSession();
    const { accountIds, ...v } = poolInput.parse(input);
    if (v.auto_refill && !v.refill_generator_id) throw new Error("자동 보충을 켜려면 생성기를 고르세요.");
    let poolId = id ? uuid.parse(id) : null;
    if (poolId) {
      const { error } = await db().from("content_pools").update(v).eq("id", poolId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await db().from("content_pools").insert(v).select("id").single();
      if (error) throw new Error(error.message);
      poolId = data.id as string;
    }
    await db().from("pool_accounts").delete().eq("pool_id", poolId);
    if (accountIds.length) {
      const { error } = await db().from("pool_accounts").insert(accountIds.map((account_id) => ({ pool_id: poolId, account_id })));
      if (error) throw new Error(error.message);
    }
    refresh(poolId);
    return { ok: true, data: { id: poolId } };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePoolAction(id: string): Promise<Result> {
  try {
    await requireSession();
    const poolId = uuid.parse(id);
    const { count } = await db()
      .from("posts")
      .select("id, pool_items!inner(pool_id)", { count: "exact", head: true })
      .eq("pool_items.pool_id", poolId)
      .in("status", ["scheduled", "processing"]);
    if (count) throw new Error(`이 창고의 글로 예약된 게시물이 ${count}개 있습니다. 먼저 취소하세요.`);
    const { error } = await db().from("content_pools").delete().eq("id", poolId);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- 글

const bulkStatus = z.enum(["available", "archived", "pending"]);

/** 일괄 승인(available) / 보관(archived) / 검수 대기로 되돌리기. 배정·사용된 글은 건드리지 않는다 */
export async function setItemsStatusAction(poolId: string, ids: string[], status: string): Promise<Result<{ changed: number }>> {
  try {
    await requireSession();
    const list = z.array(uuid).min(1).max(1000).parse(ids);
    const st = bulkStatus.parse(status);
    const from = st === "available" ? ["pending", "archived"] : st === "archived" ? ["pending", "available"] : ["available", "archived"];
    const { data, error } = await db().from("pool_items").update({ status: st }).in("id", list).eq("pool_id", uuid.parse(poolId)).in("status", from).select("id");
    if (error) throw new Error(error.message);
    refresh(poolId);
    return { ok: true, data: { changed: data?.length ?? 0 } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteItemsAction(poolId: string, ids: string[]): Promise<Result<{ deleted: number }>> {
  try {
    await requireSession();
    const list = z.array(uuid).min(1).max(1000).parse(ids);
    const { data, error } = await db().from("pool_items").delete().in("id", list).eq("pool_id", uuid.parse(poolId)).neq("status", "reserved").select("id");
    if (error) throw new Error(error.message);
    refresh(poolId);
    return { ok: true, data: { deleted: data?.length ?? 0 } };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- 채우기: CSV / 보석함 / AI



const csvRow = z.object({
  text: z.string().trim().min(1).max(5000),
  first_reply: z.string().trim().max(5000).optional().default(""),
  topic_tag: z.string().trim().max(50).optional().default(""),
  category: z.string().trim().max(30).optional().default(""),
  /** 본문 사진(브라우저가 먼저 올린 뒤의 정보), 최대 5장 */
  media: z.array(mediaItemSchema).max(CSV_MAX_IMAGES).optional().default([]),
  /** 첫 댓글 사진 1장 */
  reply_media: mediaItemSchema.nullable().optional().default(null),
});

export async function importRowsAction(poolId: string, rows: unknown[], approve: boolean): Promise<Result<{ added: number; skipped: number }>> {
  try {
    await requireSession();
    const pid = uuid.parse(poolId);
    const parsed = z.array(z.unknown()).max(5000).parse(rows).map((r) => csvRow.safeParse(r));
    const valid = parsed.filter((r) => r.success).map((r) => r.data!);
    if (!valid.length) throw new Error("가져올 수 있는 줄이 없습니다. text 열이 비어 있지 않은지 확인하세요.");
    for (let k = 0; k < valid.length; k += 500) {
      const { error } = await db()
        .from("pool_items")
        .insert(
          valid.slice(k, k + 500).map((r) => {
            const topic = r.topic_tag.replace(/^#/, "") || null;
            const hasMedia = r.media.length > 0 || !!r.reply_media;
            return {
              pool_id: pid,
              text: r.text,
              first_reply: r.first_reply || null,
              topic_tag: topic,
              category: r.category || null,
              media: r.media,
              // 사진이 있으면 글 작성 형태로도 저장(꺼낼 때 사진까지 그대로 들어가게)
              compose: hasMedia
                ? {
                    ...poolItemToContent({ text: r.text, first_reply: null, topic_tag: topic }),
                    media: r.media,
                    replies: r.first_reply || r.reply_media ? [{ text: r.first_reply, media: r.reply_media }] : [],
                  }
                : null,
              status: approve ? "available" : "pending",
              source: "csv",
            };
          }),
        );
      if (error) throw new Error(error.message);
    }
    refresh(pid);
    return { ok: true, data: { added: valid.length, skipped: parsed.length - valid.length } };
  } catch (e) {
    return fail(e);
  }
}

export async function importBookmarksAction(poolId: string, bookmarkIds: string[]): Promise<Result<{ added: number }>> {
  try {
    await requireSession();
    const pid = uuid.parse(poolId);
    const { data, error } = await db().from("bookmarks").select("text").in("id", z.array(uuid).min(1).max(500).parse(bookmarkIds));
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as { text: string }[]).filter((b) => b.text?.trim());
    if (rows.length) {
      const ins = await db().from("pool_items").insert(rows.map((b) => ({ pool_id: pid, text: b.text.trim(), status: "available", source: "bookmark" })));
      if (ins.error) throw new Error(ins.error.message);
    }
    refresh(pid);
    return { ok: true, data: { added: rows.length } };
  } catch (e) {
    return fail(e);
  }
}

const fillInput = z.object({
  count: z.coerce.number().int().min(1).max(20),
  generatorId: uuid.nullable(),
  topic: z.string().trim().max(1000).nullable(),
  autoApprove: z.boolean(),
});

/** AI 일괄 생성 작업을 만들고 바로 처리를 시작한다(응답은 즉시, 진행률은 화면에서 확인) */
export async function enqueueFillAction(poolId: string, input: z.input<typeof fillInput>): Promise<Result<{ jobId: string }>> {
  try {
    await requireSession();
    const pid = uuid.parse(poolId);
    const v = fillInput.parse(input);
    const jobId = await enqueueJob("pool_fill", { poolId: pid, ...v }, v.count);
    after(async () => {
      try {
        await runJobs(Date.now() + 280_000, 1);
      } catch (e) {
        console.error("[pools] 작업 실행 실패", e);
      }
    });
    return { ok: true, data: { jobId } };
  } catch (e) {
    return fail(e);
  }
}

export type JobStatus = { status: string; progress: number; total: number; error: string | null; result: unknown };

export async function getJobAction(jobId: string): Promise<Result<JobStatus>> {
  try {
    await requireSession();
    const { data, error } = await db().from("jobs").select("status, progress, total, error, result").eq("id", uuid.parse(jobId)).single();
    if (error) throw new Error(error.message);
    return { ok: true, data: data as JobStatus };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- 창고 글 편집(글 작성과 같은 형태)

const itemMeta = z.object({
  category: z.string().trim().max(30).nullable().optional().transform((v) => v || null),
  weight: z.coerce.number().int().min(1).max(100).default(1),
  status: z.enum(["pending", "available", "archived"]).optional(),
});

/**
 * 창고 글 저장. 본문·첫 댓글·주제·미디어는 목록·검색·AI 비교용으로 따로도 저장하고,
 * 전체 내용은 compose 에 둔다(꺼낼 때 그대로 글 작성에 들어간다).
 */
export async function savePoolContentAction(
  poolId: string,
  itemId: string | null,
  content: unknown,
  meta: z.input<typeof itemMeta>,
): Promise<Result<{ id: string }>> {
  try {
    await requireSession();
    const pid = uuid.parse(poolId);
    const c = poolContentSchema.parse(content);
    const m = itemMeta.parse(meta);
    const [disclosure, settings] = await Promise.all([loadDisclosure(c.disclosureId), getSettings()]);
    const plan = buildPlan({ ...emptyCompose(), ...c }, { disclosure, bannedWords: settings.bannedWords });
    if (hasErrors(plan)) throw new Error(plan.issues.filter((i) => i.level === "error").map((i) => i.message).join(" / "));

    const row = {
      text: c.text.trim(),
      first_reply: c.replies[0]?.text.trim() || null,
      topic_tag: c.topicTag,
      media: c.media,
      compose: c,
      category: m.category,
      weight: m.weight,
      ...(m.status ? { status: m.status } : {}),
    };
    if (itemId) {
      const { error } = await db().from("pool_items").update(row).eq("id", uuid.parse(itemId)).eq("pool_id", pid);
      if (error) throw new Error(error.message);
      refresh(pid);
      return { ok: true, data: { id: itemId } };
    }
    const { data, error } = await db()
      .from("pool_items")
      .insert({ ...row, pool_id: pid, status: m.status ?? "available", source: "manual" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    refresh(pid);
    return { ok: true, data: { id: data.id as string } };
  } catch (e) {
    return fail(e);
  }
}
