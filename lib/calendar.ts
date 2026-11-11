/**
 * KST 기준 달력 계산. 날짜는 "yyyy-MM-dd" 문자열로 다룬다(시간대 혼동 방지).
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { APP_TZ } from "./time";

const DAY = 86_400_000;

function parse(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)); // 정오(UTC)로 두면 날짜 경계 문제가 없다
}
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function isDayKey(v: string | undefined | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parse(v).getTime());
}
export const addDays = (day: string, n: number) => fmt(new Date(parse(day).getTime() + n * DAY));
export const weekday = (day: string) => parse(day).getUTCDay(); // 0=일
export const todayKst = (now = new Date()) => formatInTimeZone(now, APP_TZ, "yyyy-MM-dd");
export const dayKeyOf = (iso: string) => formatInTimeZone(new Date(iso), APP_TZ, "yyyy-MM-dd");
export const timeOf = (iso: string) => formatInTimeZone(new Date(iso), APP_TZ, "HH:mm");

export function addMonths(day: string, n: number): string {
  const d = parse(day);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12));
  return fmt(t);
}

/** 그 달을 덮는 6주(42일) 격자. 일요일 시작 */
export function monthGrid(anchor: string): string[] {
  const first = anchor.slice(0, 8) + "01";
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** anchor 가 속한 주(일~토) */
export function weekDays(anchor: string): string[] {
  const start = addDays(anchor, -weekday(anchor));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** KST 날짜 범위 [from 00:00, to 다음날 00:00) → UTC ISO */
export function kstRange(from: string, to: string): { start: string; end: string } {
  return {
    start: fromZonedTime(`${from}T00:00:00`, APP_TZ).toISOString(),
    end: fromZonedTime(`${addDays(to, 1)}T00:00:00`, APP_TZ).toISOString(),
  };
}
