import { formatInTimeZone } from "date-fns-tz";

export const APP_TZ = process.env.APP_TIMEZONE || "Asia/Seoul";

export function formatKst(iso: string | null | undefined, pattern = "yyyy-MM-dd HH:mm"): string {
  if (!iso) return "-";
  return formatInTimeZone(new Date(iso), APP_TZ, pattern);
}

export function daysUntil(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.floor((Date.parse(iso) - now) / 86_400_000);
}
