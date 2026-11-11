import { describe, expect, it } from "vitest";
import { eligibleItems, excludeReason, itemMatchesPersona, poolMatchesPersona, stockDays, weightedPick, type CandidateItem, type PoolRule } from "@/lib/pool/select";

const NOW = Date.UTC(2026, 10, 12);
const DAY = 86_400_000;
const persona = { age_group: "30s", gender: "female", job: "office" };
const pool: PoolRule = { id: "P", personaFilter: {}, reuseCooldownDays: null };
const item = (p: Partial<CandidateItem>): CandidateItem => ({ id: "i", poolId: "P", category: "일상", weight: 1, personaTags: [], usages: [], ...p });
const ctx = { accountId: "A", persona, lastCategory: null as string | null, pool, now: NOW };

describe("창고 랜덤 선택 규칙", () => {
  it("페르소나 필터", () => {
    expect(poolMatchesPersona({ gender: "female" }, persona)).toBe(true);
    expect(poolMatchesPersona({ gender: "male" }, persona)).toBe(false);
    expect(poolMatchesPersona({ gender: "any", age_group: null }, persona)).toBe(true);
    expect(poolMatchesPersona({ gender: "male" }, { ...persona, gender: "any" })).toBe(true);
    expect(itemMatchesPersona(["30s", "female"], persona)).toBe(true);
    expect(itemMatchesPersona(["20s"], persona)).toBe(false);
  });

  it("다른 계정이 쓴 글은 제외(글 하나는 계정 하나에만)", () => {
    expect(excludeReason(item({ usages: [{ accountId: "B", usedAt: new Date(NOW - 400 * DAY).toISOString() }] }), ctx)).toBe("used_by_other");
  });

  it("재사용 금지: 기간이 없으면 한 번 쓴 글은 다시 안 쓴다, 있으면 기간이 지나야 쓴다", () => {
    const used = item({ usages: [{ accountId: "A", usedAt: new Date(NOW - 10 * DAY).toISOString() }] });
    expect(excludeReason(used, ctx)).toBe("already_used");
    expect(excludeReason(used, { ...ctx, pool: { ...pool, reuseCooldownDays: 30 } })).toBe("cooldown");
    expect(excludeReason(used, { ...ctx, pool: { ...pool, reuseCooldownDays: 7 } })).toBeNull();
  });

  it("직전 글과 같은 category 는 제외", () => {
    expect(excludeReason(item({ category: "일상" }), { ...ctx, lastCategory: "일상" })).toBe("same_category");
    expect(excludeReason(item({ category: "직장" }), { ...ctx, lastCategory: "일상" })).toBeNull();
  });

  it("eligibleItems 는 창고 필터와 규칙을 함께 적용", () => {
    const pools = new Map<string, PoolRule>([
      ["P", pool],
      ["Q", { id: "Q", personaFilter: { gender: "male" }, reuseCooldownDays: null }],
    ]);
    const list = [item({ id: "1" }), item({ id: "2", poolId: "Q" }), item({ id: "3", category: "직장" }), item({ id: "4", poolId: "X" })];
    expect(eligibleItems(list, { ...ctx, pools, lastCategory: "일상" }).map((i) => i.id)).toEqual(["3"]);
  });

  it("weight 가중 랜덤", () => {
    const list = [{ id: "a", weight: 1 }, { id: "b", weight: 3 }];
    expect(weightedPick(list, () => 0.1)?.id).toBe("a"); // 0.4 < 1
    expect(weightedPick(list, () => 0.3)?.id).toBe("b"); // 1.2 >= 1
    expect(weightedPick([], () => 0.5)).toBeNull();
    const counts = { a: 0, b: 0 };
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 4000; k++) counts[weightedPick(list, rnd)!.id as "a" | "b"]++;
    expect(counts.b / counts.a).toBeGreaterThan(2.5);
    expect(counts.b / counts.a).toBeLessThan(3.5);
  });

  it("재고 일수", () => {
    expect(stockDays(25, 4)).toBe(6);
    expect(stockDays(25, 0)).toBeNull();
  });
});
