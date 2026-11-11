import "server-only";
import { db } from "@/lib/db/admin";

export type AppSettings = {
  activeHours: { start: string; end: string };
  bannedWords: string[];
  globalDailyLimit: number;
  defaultDailyPostLimit: number;
  minGapMinutes: number;
  sameAccountGapMinutes: number;
  poolEmptyBehavior: "skip" | "ai_generate";
};

export const DEFAULT_SETTINGS: AppSettings = {
  activeHours: { start: "08:00", end: "23:00" },
  bannedWords: [],
  globalDailyLimit: 100,
  defaultDailyPostLimit: 10,
  minGapMinutes: 3,
  sameAccountGapMinutes: 60,
  poolEmptyBehavior: "skip",
};

const KEY_MAP: Record<keyof AppSettings, string> = {
  activeHours: "active_hours",
  bannedWords: "banned_words",
  globalDailyLimit: "global_daily_limit",
  defaultDailyPostLimit: "default_daily_post_limit",
  minGapMinutes: "min_gap_minutes",
  sameAccountGapMinutes: "same_account_gap_minutes",
  poolEmptyBehavior: "pool_empty_behavior",
};

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await db().from("app_settings").select("key, value").in("key", Object.values(KEY_MAP));
  if (error) throw new Error(error.message);
  const byKey = new Map((data ?? []).map((r) => [r.key as string, r.value]));
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const [field, key] of Object.entries(KEY_MAP)) {
    if (byKey.has(key) && byKey.get(key) !== null) out[field] = byKey.get(key);
  }
  return out as AppSettings;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  const rows = Object.entries(patch).map(([field, value]) => ({ key: KEY_MAP[field as keyof AppSettings], value }));
  if (!rows.length) return;
  const { error } = await db().from("app_settings").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
