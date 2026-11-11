/** 예약 시간 충돌 검사(순수 함수). 시간은 epoch ms. */

export type Slot = { id: string; accountId: string; at: number; username?: string };

export type Conflict = { id: string; accountId: string; username?: string; at: number; reason: "other_account_gap" | "same_account_gap" };

const MIN = 60_000;

export function findConflicts(
  target: { accountId: string; at: number; excludeId?: string },
  slots: Slot[],
  gaps: { minGapMinutes: number; sameAccountGapMinutes: number },
): Conflict[] {
  const out: Conflict[] = [];
  for (const s of slots) {
    if (s.id === target.excludeId) continue;
    const diff = Math.abs(s.at - target.at);
    if (s.accountId === target.accountId) {
      if (gaps.sameAccountGapMinutes > 0 && diff < gaps.sameAccountGapMinutes * MIN) {
        out.push({ ...s, reason: "same_account_gap" });
      }
    } else if (gaps.minGapMinutes > 0 && diff < gaps.minGapMinutes * MIN) {
      out.push({ ...s, reason: "other_account_gap" });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * 가장 가까운 빈 시간(분 단위)을 찾는다. 원래 시간에서 +1, -1, +2, -2 … 분 순서로 최대 maxMinutes 까지.
 * notBefore 보다 이른 시간은 고르지 않는다.
 */
export function suggestNearestFree(
  target: { accountId: string; at: number; excludeId?: string },
  slots: Slot[],
  gaps: { minGapMinutes: number; sameAccountGapMinutes: number },
  opts: { notBefore: number; maxMinutes?: number },
): number | null {
  const base = Math.floor(target.at / MIN) * MIN;
  const max = opts.maxMinutes ?? 240;
  for (let d = 0; d <= max; d++) {
    for (const sign of d === 0 ? [1] : [1, -1]) {
      const at = base + sign * d * MIN;
      if (at < opts.notBefore) continue;
      if (findConflicts({ ...target, at }, slots, gaps).length === 0) return at;
    }
  }
  return null;
}
