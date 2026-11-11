import "server-only";
import { db } from "@/lib/db/admin";
import { decryptToken, encryptToken } from "@/lib/crypto/token";
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

export const ENV_KEY_NAME: Record<Provider, string> = { openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY" };

/** 설정 화면에서 등록한 키(암호화 저장). 값은 절대 브라우저로 보내지 않는다 */
type StoredKey = { enc: string; last4: string; updated_at: string };
type StoredKeys = Partial<Record<Provider, StoredKey>>;

async function loadStoredKeys(): Promise<StoredKeys> {
  const { data } = await db().from("app_settings").select("value").eq("key", "ai_keys").maybeSingle();
  return (data?.value as StoredKeys | null) ?? {};
}

export async function saveStoredKey(p: Provider, key: string | null): Promise<void> {
  const keys = await loadStoredKeys();
  if (key) keys[p] = { enc: encryptToken(key), last4: key.slice(-4), updated_at: new Date().toISOString() };
  else delete keys[p];
  const { error } = await db().from("app_settings").upsert({ key: "ai_keys", value: keys }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

/** 설정에서 등록한 키 → 없으면 환경변수 */
export async function getApiKey(p: Provider): Promise<string | null> {
  const stored = (await loadStoredKeys())[p];
  if (stored) {
    try {
      return decryptToken(stored.enc);
    } catch {
      throw new AiError("저장된 AI 키를 복호화하지 못했습니다. TOKEN_ENCRYPTION_KEY가 바뀌었다면 설정 > AI에서 키를 다시 등록하세요.", "no_key");
    }
  }
  return process.env[ENV_KEY_NAME[p]] || null;
}

export type KeyStatus = { source: "settings" | "env" | null; last4: string | null; updatedAt: string | null };

export async function keyStatuses(): Promise<Record<Provider, KeyStatus>> {
  const stored = await loadStoredKeys().catch((): StoredKeys => ({}));
  return Object.fromEntries(
    PROVIDERS.map((p) => {
      const s = stored[p];
      const env = process.env[ENV_KEY_NAME[p]];
      const v: KeyStatus = s
        ? { source: "settings", last4: s.last4, updatedAt: s.updated_at }
        : env
          ? { source: "env", last4: env.slice(-4), updatedAt: null }
          : { source: null, last4: null, updatedAt: null };
      return [p, v];
    }),
  ) as Record<Provider, KeyStatus>;
}

/** 테스트에서 가짜 provider 를 끼울 수 있게 한다 */
let override: ((p: Provider) => AiProvider) | null = null;
export function __setProviderFactory(f: ((p: Provider) => AiProvider) | null) {
  override = f;
}

export async function getProvider(p: Provider, apiKey?: string): Promise<AiProvider> {
  if (override) return override(p);
  const key = apiKey ?? (await getApiKey(p));
  if (!key) throw new AiError(`${p === "openai" ? "OpenAI" : "Gemini"} API 키가 없습니다. 설정 > AI에서 키를 등록하세요.`, "no_key");
  return p === "openai" ? new OpenAiProvider(key) : new GeminiProvider(key);
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
