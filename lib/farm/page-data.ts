import "server-only";
import { db } from "@/lib/db/admin";
import { getAiSettings, keyStatuses } from "@/lib/ai/config";
import { todayKst, addDays } from "@/lib/calendar";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/settings";
import type { FollowerTier } from "@/lib/scheduler/slots";
import type { FarmAccount, FarmGenerator, FarmPool } from "@/components/farm/farm-form";
import type { Provider } from "@/lib/ai/types";
import type { FarmConfig } from "./types";

export type BatchSummary = {
  batchId: string;
  kind: string;
  createdAt: string;
  startDate: string;
  days: number;
  mode: string;
  status: string;
  usernames: string[];
  counts: Record<string, number>;
  job: { status: string; error: string | null } | null;
  phase: string;
};

export async function loadFarmPageData(kind: "growth" | "monetize") {
  const [accRes, poolRes, genRes, settings, tierRes, ai, keys] = await Promise.all([
    db().from("threads_accounts").select("id, username, follower_count, daily_post_limit, status").neq("status", "disabled").order("username"),
    db().from("content_pools").select("id, name, pool_accounts(account_id)").order("name"),
    db().from("generators").select("id, name, kind, provider, model").eq("is_active", true).order("created_at"),
    getSettings().catch(() => DEFAULT_SETTINGS),
    db().from("app_settings").select("value").eq("key", "follower_tiers").maybeSingle(),
    getAiSettings().catch(() => null),
    keyStatuses(),
  ]);
  const generators = (genRes.data ?? []) as (FarmGenerator & { provider: string | null; model: string | null })[];
  const def = ai?.defaults.text;
  const aiReady = (!!def?.model && !!keys[def.provider].source) || generators.some((g) => g.model && g.provider && keys[g.provider as Provider]?.source);

  return {
    accounts: (accRes.data ?? []) as FarmAccount[],
    pools: ((poolRes.data ?? []) as unknown as { id: string; name: string; pool_accounts: { account_id: string }[] }[]).map((p) => ({ id: p.id, name: p.name, accountIds: p.pool_accounts.map((a) => a.account_id) })) as FarmPool[],
    generators: generators.map(({ id, name, kind }) => ({ id, name, kind })),
    tiers: ((tierRes.data?.value as FollowerTier[] | undefined) ?? [{ min: 0, max: null, daily_posts: 3 }]) as FollowerTier[],
    settings,
    aiReady,
    tomorrow: addDays(todayKst(), 1),
    batches: await loadBatches(kind),
  };
}

export async function loadBatches(kind: "growth" | "monetize"): Promise<BatchSummary[]> {
  const { data } = await db()
    .from("campaigns")
    .select("id, batch_id, start_date, days, mode, status, created_at, config, job_id, threads_accounts(username)")
    .eq("kind", kind)
    .not("batch_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(300);
  const camps = (data ?? []) as unknown as {
    id: string;
    batch_id: string;
    start_date: string;
    days: number;
    mode: string;
    status: string;
    created_at: string;
    config: FarmConfig;
    job_id: string | null;
    threads_accounts: { username: string } | null;
  }[];
  if (!camps.length) return [];
  const [postRes, jobRes] = await Promise.all([
    db().from("posts").select("campaign_id, status").in("campaign_id", camps.map((c) => c.id)).limit(50000),
    db().from("jobs").select("id, status, error").in("id", [...new Set(camps.map((c) => c.job_id).filter(Boolean) as string[])]),
  ]);
  const jobs = new Map(((jobRes.data ?? []) as { id: string; status: string; error: string | null }[]).map((j) => [j.id, j]));
  const batches = new Map<string, BatchSummary>();
  const campBatch = new Map(camps.map((c) => [c.id, c.batch_id]));
  for (const c of camps) {
    const b = batches.get(c.batch_id) ?? {
      batchId: c.batch_id,
      kind,
      createdAt: c.created_at,
      startDate: c.start_date,
      days: c.days,
      mode: c.mode,
      status: c.status,
      usernames: [],
      counts: {},
      job: c.job_id ? (jobs.get(c.job_id) ?? null) : null,
      phase: c.config.phase,
    };
    if (c.threads_accounts?.username) b.usernames.push(c.threads_accounts.username);
    if (c.status === "cancelled" && b.status !== "cancelled") b.status = b.status === "active" ? "active" : c.status;
    batches.set(c.batch_id, b);
  }
  for (const p of (postRes.data ?? []) as { campaign_id: string; status: string }[]) {
    const b = batches.get(campBatch.get(p.campaign_id)!);
    if (b) b.counts[p.status] = (b.counts[p.status] ?? 0) + 1;
  }
  return [...batches.values()];
}
