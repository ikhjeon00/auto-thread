import { describe, expect, it } from "vitest";
import { findConflicts, suggestNearestFree, type Slot } from "@/lib/scheduler/conflicts";

const M = 60_000;
const T = Date.UTC(2026, 10, 12, 3, 0); // 12:00 KST
const gaps = { minGapMinutes: 3, sameAccountGapMinutes: 60 };
const slots: Slot[] = [
  { id: "1", accountId: "B", at: T + 1 * M },
  { id: "2", accountId: "A", at: T + 90 * M },
];

describe("conflicts", () => {
  it("detects other-account gap and same-account gap", () => {
    expect(findConflicts({ accountId: "A", at: T }, slots, gaps).map((c) => c.reason)).toEqual(["other_account_gap"]);
    expect(findConflicts({ accountId: "A", at: T + 60 * M }, slots, gaps).map((c) => c.reason)).toEqual(["same_account_gap"]);
    expect(findConflicts({ accountId: "A", at: T + 10 * M }, slots, gaps)).toEqual([]);
  });
  it("gap 0 disables cross-account check; excludeId skips self", () => {
    expect(findConflicts({ accountId: "A", at: T }, slots, { ...gaps, minGapMinutes: 0 })).toEqual([]);
    expect(findConflicts({ accountId: "B", at: T + M, excludeId: "1" }, slots, gaps)).toEqual([]);
  });
  it("suggests nearest free minute", () => {
    // T 와 B(T+1) 사이 3분 간격 → 가장 가까운 빈 시간은 T-2분 (T+4분보다 가깝다)
    expect(suggestNearestFree({ accountId: "A", at: T }, slots, gaps, { notBefore: 0 })).toBe(T - 2 * M);
    // 과거로는 못 가면 앞으로
    expect(suggestNearestFree({ accountId: "A", at: T }, slots, gaps, { notBefore: T })).toBe(T + 4 * M);
  });
});
