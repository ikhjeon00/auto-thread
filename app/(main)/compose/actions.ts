"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require";
import { db } from "@/lib/db/admin";
import { savePost } from "@/lib/compose/save";
import type { ComposeInput } from "@/lib/compose/schema";
import { checkSchedule, type ScheduleCheck } from "@/lib/scheduler/check";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const uuid = z.string().uuid();

export async function saveDraftAction(input: ComposeInput, postId?: string | null): Promise<Result<{ postId: string }>> {
  try {
    await requireSession();
    const r = await savePost(input, { postId, status: "draft" });
    revalidatePath("/compose");
    return { ok: true, data: r };
  } catch (e) {
    return fail(e);
  }
}

export async function checkScheduleAction(accountId: string, iso: string, postId?: string | null): Promise<Result<ScheduleCheck>> {
  try {
    await requireSession();
    return { ok: true, data: await checkSchedule(uuid.parse(accountId), new Date(iso), postId ?? undefined) };
  } catch (e) {
    return fail(e);
  }
}

/** 예약. scheduledAt 이 null 이면 "지금 발행"(1분 안에 publish 크론이 처리) */
export async function scheduleAction(
  input: ComposeInput,
  opts: { postId?: string | null; scheduledAt: string | null },
): Promise<Result<{ postId: string }>> {
  try {
    await requireSession();
    const at = opts.scheduledAt ? new Date(opts.scheduledAt) : new Date();
    if (Number.isNaN(at.getTime())) throw new Error("발행 시간이 올바르지 않습니다.");
    if (opts.scheduledAt && at.getTime() < Date.now() - 60_000) throw new Error("지난 시간으로는 예약할 수 없습니다.");
    const r = await savePost(input, { postId: opts.postId, status: "scheduled", scheduledAt: at });
    revalidatePath("/compose");
    revalidatePath("/scheduled");
    return { ok: true, data: r };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDraftAction(postId: string): Promise<Result> {
  try {
    await requireSession();
    const { error } = await db().from("posts").delete().eq("id", uuid.parse(postId)).eq("status", "draft");
    if (error) throw new Error(error.message);
    revalidatePath("/compose");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** 유사도 검사용: 같은 계정의 최근 글 30개 */
export async function recentTextsAction(accountId: string, excludePostId?: string | null): Promise<Result<string[]>> {
  try {
    await requireSession();
    let q = db()
      .from("posts")
      .select("text")
      .eq("account_id", uuid.parse(accountId))
      .in("status", ["scheduled", "processing", "published"])
      .order("created_at", { ascending: false })
      .limit(30);
    if (excludePostId) q = q.neq("id", excludePostId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true, data: (data ?? []).map((r) => r.text as string).filter(Boolean) };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- AI 모드

const generateInput = z.object({
  accountId: z.string().uuid(),
  generatorId: z.string().uuid().nullable().optional(),
  kind: z.enum(["general", "product"]),
  topic: z.string().max(1000).nullable().optional(),
  count: z.number().int().min(1).max(5).default(3),
});

export type GeneratedCandidate = {
  text: string;
  first_reply: string;
  topic_tag: string;
  category: string;
  issues: string[];
  meta: { generatorId: string; generatorName: string; topic: string; format: string; length: string; model: string; costUsd: number | null };
};

export async function generateAction(input: z.input<typeof generateInput>): Promise<Result<GeneratedCandidate[]>> {
  try {
    await requireSession();
    const v = generateInput.parse(input);
    const { generatePosts } = await import("@/lib/ai/generate");
    const r = await generatePosts({ ...v, purpose: "compose" });
    const meta = {
      generatorId: r.meta.generatorId,
      generatorName: r.meta.generatorName,
      topic: r.meta.topic,
      format: r.meta.format,
      length: r.meta.length,
      model: `${r.meta.model.provider}:${r.meta.model.model}`,
      // 여러 개를 한 번에 만들었으니 글 하나당 비용으로 나눠 보여준다
      costUsd: r.meta.costUsd === null ? null : r.meta.costUsd / Math.max(1, r.posts.length),
    };
    return { ok: true, data: r.posts.map((p) => ({ ...p, meta })) };
  } catch (e) {
    return fail(e);
  }
}

const personaInput = z.object({
  age_group: z.enum(["20s", "30s", "40s_early", "40s_late", "any"]).nullable(),
  gender: z.enum(["male", "female", "any"]).nullable(),
  job: z.enum(["office", "self_employed", "business", "homemaker", "any"]).nullable(),
  tone: z.string().max(300).nullable(),
});
export type PersonaInput = z.infer<typeof personaInput>;

export async function savePersonaAction(accountId: string, input: PersonaInput): Promise<Result> {
  try {
    await requireSession();
    const p = personaInput.parse(input);
    const { error } = await db()
      .from("personas")
      .upsert({ account_id: uuid.parse(accountId), ...p, tone: p.tone?.trim() || null }, { onConflict: "account_id" });
    if (error) throw new Error(error.message);
    revalidatePath("/compose");
    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
