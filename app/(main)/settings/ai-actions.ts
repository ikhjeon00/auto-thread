"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require";
import { errorMessage } from "@/lib/errors";
import { db } from "@/lib/db/admin";
import { getProvider, saveStoredKey } from "@/lib/ai/config";
import { PROVIDERS } from "@/lib/ai/types";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: errorMessage(e) });
const uuid = z.string().uuid();
const provider = z.enum(PROVIDERS);

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/compose");
}

// ---------------------------------------------------------------- API 키

/** 키를 등록한다. 저장 전에 모델 목록을 불러와 키가 맞는지 확인한다 */
export async function saveApiKeyAction(p: string, key: string): Promise<Result<{ models: number }>> {
  try {
    await requireSession();
    const name = provider.parse(p);
    const k = z
      .string()
      .trim()
      .min(10, "키가 너무 짧습니다.")
      .max(500)
      .regex(/^\S+$/, "키에 공백이 들어 있습니다.")
      .parse(key);
    if (!process.env.TOKEN_ENCRYPTION_KEY) throw new Error("TOKEN_ENCRYPTION_KEY 환경변수가 없어 키를 안전하게 저장할 수 없습니다.");
    const models = await (await getProvider(name, k)).listModels();
    await saveStoredKey(name, k);
    refresh();
    return { ok: true, data: { models: models.length } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteApiKeyAction(p: string): Promise<Result> {
  try {
    await requireSession();
    await saveStoredKey(provider.parse(p), null);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- 모델·단가

/** 저장 전에 그 모델을 실제로 쓸 수 있는지 짧게 시험 호출한다 */
async function assertModelUsable(ref: { provider: (typeof PROVIDERS)[number] | null; model: string | null }, label: string) {
  if (!ref.provider || !ref.model) return;
  try {
    await (await getProvider(ref.provider)).checkModel(ref.model);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${label} 모델 ${ref.provider}:${ref.model} 을(를) 쓸 수 없어 저장하지 않았습니다. ${msg}`);
  }
}

export async function listModelsAction(p: string): Promise<Result<string[]>> {
  try {
    await requireSession();
    const name = provider.parse(p);
    return { ok: true, data: await (await getProvider(name)).listModels() };
  } catch (e) {
    return fail(e);
  }
}

const modelRef = z.object({ provider, model: z.string().trim().max(100) });
const defaultsInput = z.object({ text: modelRef, vision: modelRef });

export async function saveAiDefaultsAction(input: z.input<typeof defaultsInput>): Promise<Result> {
  try {
    await requireSession();
    const value = defaultsInput.parse(input);
    await assertModelUsable(value.text, "글쓰기");
    if (value.vision.provider !== value.text.provider || value.vision.model !== value.text.model) {
      await assertModelUsable(value.vision, "사진 이해");
    }
    const { error } = await db().from("app_settings").upsert({ key: "ai_defaults", value }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

const price = z.object({
  input: z.coerce.number().min(0).max(1000),
  output: z.coerce.number().min(0).max(1000),
  cached: z.coerce.number().min(0).max(1000).optional(),
});
const pricingInput = z.record(z.string().regex(/^(openai|gemini):\S+$/, "모델 키 형식이 올바르지 않습니다."), price);

export async function savePricingAction(input: z.input<typeof pricingInput>): Promise<Result> {
  try {
    await requireSession();
    const value = pricingInput.parse(input);
    const { error } = await db().from("app_settings").upsert({ key: "ai_pricing", value }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- 생성기

const generatorInput = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요.").max(50),
  version: z.coerce.number().int().min(1).max(999),
  kind: z.enum(["daily", "product", "vision"]),
  system_prompt: z.string().trim().min(1, "시스템 프롬프트를 입력하세요.").max(10000),
  user_prompt_template: z.string().trim().min(1, "사용자 프롬프트 템플릿을 입력하세요.").max(10000),
  provider: provider.nullable(),
  model: z.string().trim().max(100).nullable(),
  example_count: z.coerce.number().int().min(0).max(5),
  is_active: z.boolean(),
});
export type GeneratorInput = z.input<typeof generatorInput>;

export async function saveGeneratorAction(id: string | null, input: GeneratorInput): Promise<Result> {
  try {
    await requireSession();
    const v = generatorInput.parse(input);
    const row = { ...v, model: v.model || null, provider: v.model ? v.provider : null };
    await assertModelUsable(row, "생성기");
    const { error } = id ? await db().from("generators").update(row).eq("id", uuid.parse(id)) : await db().from("generators").insert(row);
    if (error) throw new Error(error.code === "23505" ? "같은 이름·버전의 생성기가 있습니다. 버전을 올리세요." : error.message);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteGeneratorAction(id: string): Promise<Result> {
  try {
    await requireSession();
    const { error } = await db().from("generators").delete().eq("id", uuid.parse(id));
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- 주제·글 형식

const topicInput = z.object({
  category: z.string().trim().min(1, "카테고리를 입력하세요.").max(30),
  topic: z.string().trim().min(1, "주제를 입력하세요.").max(200),
  keywords: z.array(z.string().trim().min(1).max(30)).max(20),
});

export async function saveTopicAction(id: string | null, input: z.input<typeof topicInput>): Promise<Result> {
  try {
    await requireSession();
    const v = topicInput.parse(input);
    const { error } = id ? await db().from("topics").update(v).eq("id", uuid.parse(id)) : await db().from("topics").insert(v);
    if (error) throw new Error(error.code === "23505" ? "같은 카테고리에 같은 주제가 있습니다." : error.message);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** 여러 줄 한꺼번에: "카테고리 | 주제 | 키워드1, 키워드2" */
export async function bulkAddTopicsAction(text: string): Promise<Result<{ added: number; skipped: number }>> {
  try {
    await requireSession();
    const rows = z
      .string()
      .max(50000)
      .parse(text)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [category, topic, kw] = l.split("|").map((x) => x?.trim() ?? "");
        return topicInput.safeParse({ category, topic, keywords: (kw ?? "").split(",").map((k) => k.trim()).filter(Boolean) });
      });
    const valid = rows.filter((r) => r.success).map((r) => r.data!);
    if (!valid.length) throw new Error("형식에 맞는 줄이 없습니다. 예) 일상 | 주말 산책 | 산책, 날씨");
    const { data, error } = await db().from("topics").upsert(valid, { onConflict: "category,topic", ignoreDuplicates: true }).select("id");
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, data: { added: data?.length ?? 0, skipped: rows.length - (data?.length ?? 0) } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTopicAction(id: string): Promise<Result> {
  try {
    await requireSession();
    const { error } = await db().from("topics").delete().eq("id", uuid.parse(id));
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

const formatInput = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요.").max(30),
  instruction: z.string().trim().min(1, "설명을 입력하세요.").max(500),
  is_active: z.boolean(),
});

export async function saveFormatAction(id: string | null, input: z.input<typeof formatInput>): Promise<Result> {
  try {
    await requireSession();
    const v = formatInput.parse(input);
    const { error } = id ? await db().from("post_formats").update(v).eq("id", uuid.parse(id)) : await db().from("post_formats").insert(v);
    if (error) throw new Error(error.code === "23505" ? "같은 이름의 글 형식이 있습니다." : error.message);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteFormatAction(id: string): Promise<Result> {
  try {
    await requireSession();
    const { error } = await db().from("post_formats").delete().eq("id", uuid.parse(id));
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
