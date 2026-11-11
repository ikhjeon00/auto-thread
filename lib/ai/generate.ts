import "server-only";
import { db } from "@/lib/db/admin";
import { notify } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { getAiSettings, getProvider, resolveModel } from "./config";
import { costUsd, priceKey } from "./pricing";
import { COMMON_RULES, LENGTHS, POSTS_SCHEMA, fillTemplate, pickRandom, sample, type PersonaLite } from "./prompt";
import { AiError, type ModelRef, type Usage } from "./types";
import { generatedSchema, validateGenerated, type GeneratedPost } from "./validate";

export type GenerateInput = {
  accountId: string;
  generatorId?: string | null;
  kind: "general" | "product";
  /** 사용자가 정한 주제(상품이면 상품명·특징). 비우면 주제 풀에서 랜덤 */
  topic?: string | null;
  count: number;
  purpose: "compose" | "pool" | "farm";
  images?: { url: string; mimeType?: string }[];
  jobId?: string | null;
};

export type GenerateMeta = {
  generatorId: string;
  generatorName: string;
  topic: string;
  format: string;
  length: string;
  model: ModelRef;
  usage: Usage;
  costUsd: number | null;
};

export type GenerateResult = { posts: GeneratedPost[]; meta: GenerateMeta };

type GeneratorRow = {
  id: string;
  name: string;
  kind: string;
  system_prompt: string;
  user_prompt_template: string;
  provider: string | null;
  model: string | null;
  example_count: number;
};

async function loadGenerator(id: string | null | undefined, kind: GenerateInput["kind"], hasImages: boolean): Promise<GeneratorRow> {
  const cols = "id, name, kind, system_prompt, user_prompt_template, provider, model, example_count";
  if (id) {
    const { data } = await db().from("generators").select(cols).eq("id", id).maybeSingle();
    if (!data) throw new AiError("선택한 생성기를 찾을 수 없습니다.", "api");
    return data as GeneratorRow;
  }
  const kinds = hasImages ? ["vision", "product"] : kind === "product" ? ["product"] : ["daily"];
  const { data } = await db().from("generators").select(cols).eq("is_active", true).in("kind", kinds).order("created_at").limit(1);
  if (!data?.length) throw new AiError("사용할 수 있는 생성기가 없습니다. 설정 > AI에서 생성기를 추가하세요.", "api");
  return data[0] as GeneratorRow;
}

async function pickTopic(userTopic: string | null | undefined): Promise<string> {
  if (userTopic?.trim()) return userTopic.trim();
  // 최근에 쓰지 않은 주제 20개 중 랜덤
  const { data } = await db().from("topics").select("id, category, topic, keywords").order("last_used_at", { ascending: true, nullsFirst: true }).limit(20);
  const t = pickRandom((data ?? []) as { id: string; category: string; topic: string; keywords: string[] }[]);
  if (!t) return "일상 속 소소한 이야기";
  await db().from("topics").update({ last_used_at: new Date().toISOString() }).eq("id", t.id);
  return `${t.category} — ${t.topic}${t.keywords?.length ? ` (키워드: ${t.keywords.join(", ")})` : ""}`;
}

export async function generatePosts(input: GenerateInput): Promise<GenerateResult> {
  const count = Math.max(1, Math.min(20, Math.floor(input.count)));
  const hasImages = !!input.images?.length;
  const [gen, ai, settings, personaRes, formatsRes, bookmarksRes, recentRes] = await Promise.all([
    loadGenerator(input.generatorId, input.kind, hasImages),
    getAiSettings(),
    getSettings(),
    db().from("personas").select("age_group, gender, job, tone").eq("account_id", input.accountId).maybeSingle(),
    db().from("post_formats").select("name, instruction").eq("is_active", true),
    db().from("bookmarks").select("text").order("created_at", { ascending: false }).limit(50),
    db()
      .from("posts")
      .select("text")
      .eq("account_id", input.accountId)
      .in("status", ["scheduled", "processing", "published"])
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const model = resolveModel(gen, hasImages ? ai.defaults.vision : ai.defaults.text);
  const provider = getProvider(model.provider);
  const topic = await pickTopic(input.topic);
  const fmt = pickRandom((formatsRes.data ?? []) as { name: string; instruction: string }[]);
  const format = fmt ? `${fmt.name}: ${fmt.instruction}` : "자유 형식";
  const length = pickRandom([...LENGTHS])!;
  const examples = sample(((bookmarksRes.data ?? []) as { text: string }[]).map((b) => b.text), Math.max(0, Math.min(5, gen.example_count)));
  const recent = ((recentRes.data ?? []) as { text: string }[]).map((r) => r.text).filter(Boolean);
  const persona = (personaRes.data as PersonaLite | null) ?? null;
  const system = `${gen.system_prompt.trim()}\n${COMMON_RULES}`;

  const usage: Usage = { input: 0, output: 0, cached: 0, reasoning: 0 };
  let totalCost: number | null = 0;

  const call = async (n: number, extra?: string) => {
    const prompt = fillTemplate(gen.user_prompt_template, { count: n, persona, topic, format, length: length.instruction, examples, recentPosts: recent, extra });
    const res = await provider.generateJson({ model: model.model, system, prompt, images: input.images, schemaName: "threads_posts", schema: POSTS_SCHEMA });
    for (const k of Object.keys(usage) as (keyof Usage)[]) usage[k] += res.usage[k];
    const cost = costUsd(res.usage, ai.pricing[priceKey(model)]);
    totalCost = cost === null || totalCost === null ? null : totalCost + cost;
    await db().from("generation_logs").insert({
      job_id: input.jobId ?? null,
      model: model.model,
      provider: model.provider,
      purpose: input.purpose,
      input_tokens: res.usage.input,
      output_tokens: res.usage.output,
      cost_usd: cost ?? 0,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(res.text);
    } catch {
      throw new AiError("AI 응답을 해석하지 못했습니다(JSON 형식 아님). 다시 시도하세요.", "invalid_output");
    }
    const ok = generatedSchema.safeParse(parsed);
    if (!ok.success) throw new AiError("AI 응답 형식이 올바르지 않습니다. 다시 시도하세요.", "invalid_output");
    return ok.data.posts;
  };

  try {
    const first = validateGenerated((await call(count)).slice(0, count), { recent, banned: settings.bannedWords });
    let posts = first;
    const failed = first.filter((p) => p.issues.length);
    if (failed.length) {
      // 검사에 실패한 글만 한 번 더 만든다
      const good = first.filter((p) => !p.issues.length);
      const reasons = [...new Set(failed.flatMap((p) => p.issues))].join(" / ");
      const retry = validateGenerated((await call(failed.length, `앞서 만든 글 중 일부가 검사에서 떨어졌습니다(${reasons}). 이 문제를 피해서 새로 ${failed.length}개를 써 주세요.`)).slice(0, failed.length), {
        recent,
        banned: settings.bannedWords,
        accepted: good.map((p) => p.text),
      });
      // 다시 만든 글 중 통과한 것을 우선, 모자라면 처음 실패한 글(문제 표시와 함께)
      const retryGood = retry.filter((p) => !p.issues.length);
      posts = [...good, ...retryGood, ...[...retry.filter((p) => p.issues.length), ...failed].slice(0, Math.max(0, count - good.length - retryGood.length))];
    }
    return {
      posts,
      meta: { generatorId: gen.id, generatorName: gen.name, topic, format, length: length.label, model, usage, costUsd: totalCost },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await notify("error", "ai_error", `AI 글 생성 실패(${model.provider}:${model.model}): ${msg}`, input.purpose === "compose" ? "/compose" : undefined);
    throw e;
  }
}

/** 이번 달(KST) AI 비용 합계 */
export async function monthlyAiCost(): Promise<{ total: number; byModel: { key: string; usd: number; calls: number }[] }> {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const start = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 3600_000).toISOString();
  const { data } = await db().from("generation_logs").select("provider, model, cost_usd").gte("created_at", start).limit(10000);
  const m = new Map<string, { usd: number; calls: number }>();
  for (const r of (data ?? []) as { provider: string | null; model: string; cost_usd: number }[]) {
    const k = `${r.provider ?? "?"}:${r.model}`;
    const cur = m.get(k) ?? { usd: 0, calls: 0 };
    cur.usd += Number(r.cost_usd) || 0;
    cur.calls++;
    m.set(k, cur);
  }
  const byModel = [...m.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.usd - a.usd);
  return { total: byModel.reduce((s, x) => s + x.usd, 0), byModel };
}
