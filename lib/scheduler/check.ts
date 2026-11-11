import "server-only";
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db/admin";
import { getSettings } from "@/lib/settings";
import { APP_TZ } from "@/lib/time";
import { findConflicts, suggestNearestFree, type Conflict, type Slot } from "./conflicts";

export type ScheduleCheck = {
  conflicts: (Conflict & { atIso: string })[];
  suggestion: string | null; // ISO
  accountDaily: { count: number; limit: number };
  globalDaily: { count: number; limit: number };
  outsideActiveHours: boolean;
};

const ACTIVE_STATUSES = ["scheduled", "processing", "published"];

/** KST 하루의 시작·끝(UTC ISO) */
export function kstDayRange(at: Date): { start: string; end: string } {
  const day = formatInTimeZone(at, APP_TZ, "yyyy-MM-dd");
  const start = fromZonedTime(`${day}T00:00:00`, APP_TZ);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}

export async function checkSchedule(accountId: string, at: Date, excludePostId?: string): Promise<ScheduleCheck> {
  const settings = await getSettings();
  const windowMs = 5 * 3600_000;
  const [slotsRes, accRes, dayAcc, dayAll] = await Promise.all([
    db()
      .from("posts")
      .select("id, account_id, scheduled_at, threads_accounts(username)")
      .in("status", ["scheduled", "processing"])
      .gte("scheduled_at", new Date(at.getTime() - windowMs).toISOString())
      .lte("scheduled_at", new Date(at.getTime() + windowMs).toISOString()),
    db().from("threads_accounts").select("daily_post_limit").eq("id", accountId).single(),
    countDay(at, accountId, excludePostId),
    countDay(at, undefined, excludePostId),
  ]);
  if (slotsRes.error) throw new Error(slotsRes.error.message);

  const slots: Slot[] = (slotsRes.data ?? []).map((r) => ({
    id: r.id as string,
    accountId: r.account_id as string,
    at: Date.parse(r.scheduled_at as string),
    username: (r.threads_accounts as unknown as { username: string } | null)?.username,
  }));
  const gaps = { minGapMinutes: settings.minGapMinutes, sameAccountGapMinutes: settings.sameAccountGapMinutes };
  const target = { accountId, at: at.getTime(), excludeId: excludePostId };
  const conflicts = findConflicts(target, slots, gaps);
  const suggestion = conflicts.length
    ? suggestNearestFree(target, slots, gaps, { notBefore: Date.now() + 60_000 })
    : null;

  const local = toZonedTime(at, APP_TZ);
  const hm = `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
  const { start, end } = settings.activeHours;

  return {
    conflicts: conflicts.map((c) => ({ ...c, atIso: new Date(c.at).toISOString() })),
    suggestion: suggestion ? new Date(suggestion).toISOString() : null,
    accountDaily: { count: dayAcc, limit: (accRes.data?.daily_post_limit as number | undefined) ?? settings.defaultDailyPostLimit },
    globalDaily: { count: dayAll, limit: settings.globalDailyLimit },
    outsideActiveHours: hm < start || hm > end,
  };
}

async function countDay(at: Date, accountId?: string, excludePostId?: string): Promise<number> {
  const { start, end } = kstDayRange(at);
  let q = db()
    .from("posts")
    .select("id", { count: "exact", head: true })
    .in("status", ACTIVE_STATUSES)
    .gte("scheduled_at", start)
    .lt("scheduled_at", end);
  if (accountId) q = q.eq("account_id", accountId);
  if (excludePostId) q = q.neq("id", excludePostId);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}
