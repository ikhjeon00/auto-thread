import { describe, expect, it } from "vitest";
import { planSlots, recommendDaily, type PlanInput } from "@/lib/scheduler/slots";

const MIN = 60_000;
const D0 = Date.UTC(2026, 10, 20, -9); // 2026-11-20 00:00 KST
const days = ["2026-11-20", "2026-11-21"];
const toEpoch = (day: string, hm: string) => D0 + (Number(day.slice(8)) - 20) * 86_400_000 + (Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3))) * MIN;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const base = (p: Partial<PlanInput> = {}): PlanInput => ({
  days,
  accounts: [
    { id: "A", dailyCount: 5, dailyLimit: 10 },
    { id: "B", dailyCount: 5, dailyLimit: 10 },
    { id: "C", dailyCount: 5, dailyLimit: 10 },
  ],
  activeStart: "08:00",
  activeEnd: "23:00",
  toEpoch,
  existing: [],
  existingCounts: new Map(),
  minGapMinutes: 3,
  sameAccountGapMinutes: 60,
  globalDailyLimit: 100,
  notBefore: 0,
  rnd,
  ...p,
});

describe("planSlots", () => {
  it("활동 시간대 안에, 같은 계정 60분·계정 간 3분 간격을 지켜 배치", () => {
    const r = planSlots(base());
    expect(r.slots).toHaveLength(30);
    expect(r.skipped).toHaveLength(0);
    for (const s of r.slots) {
      expect(s.at).toBeGreaterThanOrEqual(toEpoch(s.day, "08:00"));
      expect(s.at).toBeLessThan(toEpoch(s.day, "23:00"));
      expect(s.at % MIN).toBe(0);
    }
    for (let i = 0; i < r.slots.length; i++)
      for (let j = i + 1; j < r.slots.length; j++) {
        const a = r.slots[i], b = r.slots[j];
        const gap = Math.abs(a.at - b.at) / MIN;
        if (a.accountId === b.accountId) expect(gap).toBeGreaterThanOrEqual(60);
        else expect(gap).toBeGreaterThanOrEqual(3);
      }
  });

  it("슬롯은 균등 분할 근처(±20분 + 조정)에 놓인다", () => {
    const r = planSlots(base({ accounts: [{ id: "A", dailyCount: 3, dailyLimit: 10 }], days: ["2026-11-20"] }));
    const centers = ["10:30", "15:30", "20:30"].map((hm) => toEpoch("2026-11-20", hm));
    r.slots.forEach((s, i) => expect(Math.abs(s.at - centers[i])).toBeLessThanOrEqual(21 * MIN));
  });

  it("기존 예약을 피하고, 계정·전역 하루 상한을 지킨다", () => {
    const existing = [{ id: "x", accountId: "Z", at: toEpoch("2026-11-20", "10:30") }];
    const counts = new Map([
      ["A|2026-11-20", 8],
      ["*|2026-11-21", 97],
    ]);
    const r = planSlots(base({ existing, existingCounts: counts }));
    expect(r.slots.filter((s) => s.accountId === "A" && s.day === "2026-11-20")).toHaveLength(2);
    expect(r.slots.filter((s) => s.day === "2026-11-21")).toHaveLength(3);
    expect(r.skipped.filter((s) => s.reason === "계정 하루 상한")).toHaveLength(3);
    expect(r.skipped.filter((s) => s.reason === "전역 하루 상한")).toHaveLength(12);
    for (const s of r.slots) expect(Math.abs(s.at - existing[0].at)).toBeGreaterThanOrEqual(3 * MIN);
  });

  it("같은 계정 간격을 지킬 수 없으면 건너뛴다", () => {
    const r = planSlots(base({ accounts: [{ id: "A", dailyCount: 20, dailyLimit: 30 }], days: ["2026-11-20"] }));
    expect(r.slots.length).toBeLessThanOrEqual(15);
    expect(r.skipped.length).toBe(20 - r.slots.length);
  });

  it("지난 시간은 쓰지 않는다", () => {
    const r = planSlots(base({ notBefore: toEpoch("2026-11-20", "18:00"), accounts: [{ id: "A", dailyCount: 5, dailyLimit: 10 }] }));
    expect(r.slots.every((s) => s.at >= toEpoch("2026-11-20", "18:00"))).toBe(true);
    expect(r.slots.filter((s) => s.day === "2026-11-21")).toHaveLength(5);
  });

  it("팔로워 구간표 추천", () => {
    const tiers = [
      { min: 0, max: 99, daily_posts: 3 },
      { min: 100, max: 499, daily_posts: 4 },
      { min: 500, max: null, daily_posts: 6 },
    ];
    expect(recommendDaily(null, tiers)).toBe(3);
    expect(recommendDaily(250, tiers)).toBe(4);
    expect(recommendDaily(10_000, tiers)).toBe(6);
  });
});
