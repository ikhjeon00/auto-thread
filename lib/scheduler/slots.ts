/**
 * 농장 시간 배치(작업지시서 8장, 순수 함수)
 *  - 활동 시간대를 하루 게시 수로 균등 분할, 각 슬롯에 ±(간격의 30%, 최대 20분) 랜덤 오차
 *  - 같은 계정 글은 최소 sameAccountGapMinutes(기본 60분) 간격
 *  - 전체 계정 기준 minGapMinutes(설정, 0이면 제한 없음) 이상
 *  - 계정별 하루 상한, 전역 하루 상한을 넘지 않음
 * 시간은 epoch ms, 날짜는 KST "yyyy-MM-dd".
 */
import { findConflicts, type Slot } from "./conflicts";

const MIN = 60_000;

export type PlanAccount = { id: string; dailyCount: number; dailyLimit: number };
export type PlanInput = {
  days: string[];
  accounts: PlanAccount[];
  /** "HH:mm" */
  activeStart: string;
  activeEnd: string;
  /** KST 날짜·시각 → epoch ms */
  toEpoch: (day: string, hm: string) => number;
  existing: Slot[];
  /** 이미 잡힌 하루 글 수: key `${accountId}|${day}` 와 `*|${day}` */
  existingCounts: Map<string, number>;
  minGapMinutes: number;
  sameAccountGapMinutes: number;
  globalDailyLimit: number;
  notBefore: number;
  rnd?: () => number;
};
export type PlannedSlot = { accountId: string; day: string; at: number };
export type PlanResult = { slots: PlannedSlot[]; skipped: { accountId: string; day: string; reason: string }[] };

function shuffle<T>(a: T[], rnd: () => number): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function planSlots(input: PlanInput): PlanResult {
  const rnd = input.rnd ?? Math.random;
  const gaps = { minGapMinutes: input.minGapMinutes, sameAccountGapMinutes: input.sameAccountGapMinutes };
  const taken: Slot[] = [...input.existing];
  const counts = new Map(input.existingCounts);
  const out: PlanResult = { slots: [], skipped: [] };
  let seq = 0;

  for (const day of input.days) {
    const winStart = input.toEpoch(day, input.activeStart);
    const winEnd = input.toEpoch(day, input.activeEnd);
    if (winEnd <= winStart) continue;
    for (const acc of shuffle(input.accounts, rnd)) {
      const room = Math.max(0, acc.dailyLimit - (counts.get(`${acc.id}|${day}`) ?? 0));
      const n = Math.min(acc.dailyCount, room);
      for (let k = n; k < acc.dailyCount; k++) out.skipped.push({ accountId: acc.id, day, reason: "계정 하루 상한" });
      if (n <= 0) continue;
      const interval = (winEnd - winStart) / n;
      const jitter = Math.min(0.3 * interval, 20 * MIN);
      for (let i = 0; i < n; i++) {
        if ((counts.get(`*|${day}`) ?? 0) >= input.globalDailyLimit) {
          out.skipped.push({ accountId: acc.id, day, reason: "전역 하루 상한" });
          continue;
        }
        const base = winStart + interval * (i + 0.5) + (rnd() * 2 - 1) * jitter;
        // 가장 가까운 빈 분(minute)을 슬롯 범위(간격의 절반) 안에서 찾는다
        const lo = Math.max(winStart, input.notBefore, winStart + interval * i);
        const hi = Math.min(winEnd, winStart + interval * (i + 1));
        const at = nearestFree(Math.min(Math.max(base, lo), hi), lo, hi, acc.id, taken, gaps);
        if (at === null) {
          out.skipped.push({ accountId: acc.id, day, reason: lo >= hi ? "이미 지난 시간" : "간격 규칙을 지킬 빈 시간이 없음" });
          continue;
        }
        taken.push({ id: `new-${seq++}`, accountId: acc.id, at });
        counts.set(`${acc.id}|${day}`, (counts.get(`${acc.id}|${day}`) ?? 0) + 1);
        counts.set(`*|${day}`, (counts.get(`*|${day}`) ?? 0) + 1);
        out.slots.push({ accountId: acc.id, day, at });
      }
    }
  }
  out.slots.sort((a, b) => a.at - b.at);
  return out;
}

function nearestFree(target: number, lo: number, hi: number, accountId: string, taken: Slot[], gaps: { minGapMinutes: number; sameAccountGapMinutes: number }): number | null {
  if (lo >= hi) return null;
  const base = Math.round(target / MIN) * MIN;
  const span = Math.ceil((hi - lo) / MIN);
  for (let d = 0; d <= span; d++) {
    for (const sign of d === 0 ? [1] : [1, -1]) {
      const at = base + sign * d * MIN;
      if (at < lo || at >= hi) continue;
      if (findConflicts({ accountId, at }, taken, gaps).length === 0) return at;
    }
  }
  return null;
}

/** 팔로워 구간표로 하루 게시 수 추천 */
export type FollowerTier = { min: number; max: number | null; daily_posts: number };
export function recommendDaily(followers: number | null, tiers: FollowerTier[]): number {
  const f = followers ?? 0;
  const t = tiers.find((x) => f >= x.min && (x.max === null || f <= x.max));
  return t?.daily_posts ?? tiers[0]?.daily_posts ?? 3;
}
