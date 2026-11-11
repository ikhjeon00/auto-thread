import "server-only";
import { db } from "@/lib/db/admin";
import type { PricingTable } from "./pricing";
import { AiError, PROVIDERS, type AiProvider, type ModelRef, type Provider } from "./types";
import { OpenAiProvider } from "./providers/openai";
import { GeminiProvider } from "./providers/gemini";

export type AiDefaults = { text: ModelRef; vision: ModelRef };

const EMPTY: AiDefaults = { text: { provider: "gemini", model: "" }, vision: { provider: "gemini", model: "" } };

export async function getAiSettings(): Promise<{ defaults: AiDefaults; pricing: PricingTable }> {
  const { data } = await db().from("app_settings").select("key, value").in("key", ["ai_defaults", "ai_pricing"]);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value]));
  return {
    defaults: { ...EMPTY, ...((map.get("ai_defaults") as AiDefaults | undefined) ?? {}) },
    pricing: (map.get("ai_pricing") as PricingTable | undefined) ?? {},
  };
}

export const keyConfigured = (p: Provider) => !!(p === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY);

export function providerStatus(): Record<Provider, boolean> {
  return Object.fromEntries(PROVIDERS.map((p) => [p, keyConfigured(p)])) as Record<Provider, boolean>;
}

/** 테스트에서 가짜 provider 를 끼울 수 있게 한다 */
let override: ((p: Provider) => AiProvider) | null = null;
export function __setProviderFactory(f: ((p: Provider) => AiProvider) | null) {
  override = f;
}

export function getProvider(p: Provider): AiProvider {
  if (override) return override(p);
  return p === "openai" ? new OpenAiProvider() : new GeminiProvider();
}

/** 생성기 설정 → 없으면 기본 모델 */
export function resolveModel(gen: { provider: string | null; model: string | null } | null, fallback: ModelRef): ModelRef {
  const provider = (gen?.provider as Provider | null) ?? fallback.provider;
  const model = gen?.model?.trim() || (provider === fallback.provider ? fallback.model : "");
  if (!model) {
    throw new AiError("사용할 AI 모델이 정해지지 않았습니다. 설정 > AI에서 기본 모델을 고르세요.", "no_model");
  }
  return { provider, model };
}
