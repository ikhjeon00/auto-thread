/**
 * 글 창고 랜덤 선택 규칙 (작업지시서 8장, 순수 함수)
 *  - 후보: 계정에 연결된 창고의 available 글 중 페르소나 필터가 맞는 것
 *  - 제외: 다른 계정이 이미 쓴 글(글 하나는 계정 하나에만), 재사용 금지 기간 안의 글,
 *          이 계정의 직전 글과 같은 category
 *  - weight 가중 랜덤
 */

export type Persona = { age_group: string | null; gender: string | null; job: string | null };
export type PersonaFilter = Partial<Record<keyof Persona, string | null>>;

export type PoolRule = { id: string; personaFilter: PersonaFilter; reuseCooldownDays: number | null };

export type CandidateItem = {
  id: string;
  poolId: string;
  category: string | null;
  weight: number;
  personaTags: string[];
  usages: { accountId: string; usedAt: string }[];
};

export type ExcludeReason = "persona" | "used_by_other" | "already_used" | "cooldown" | "same_category";

const DAY = 86_400_000;

/** 창고 페르소나 필터: 지정한 항목은 계정 페르소나와 같아야 한다('무관'은 통과) */
export function poolMatchesPersona(filter: PersonaFilter, persona: Persona | null): boolean {
  for (const key of ["age_group", "gender", "job"] as const) {
    const want = filter[key];
    if (!want || want === "any") continue;
    const have = persona?.[key];
    if (!have || have === "any") continue; // 계정이 '무관'이면 막지 않는다
    if (have !== want) return false;
  }
  return true;
}

/** 글 단위 페르소나 태그: 태그가 있으면 모두 계정 페르소나 값 중에 있어야 한다 */
export function itemMatchesPersona(tags: string[], persona: Persona | null): boolean {
  if (!tags.length) return true;
  const values = new Set([persona?.age_group, persona?.gender, persona?.job].filter(Boolean) as string[]);
  return tags.every((t) => t === "any" || values.has(t));
}

export function excludeReason(
  item: CandidateItem,
  ctx: { accountId: string; persona: Persona | null; lastCategory: string | null; pool: PoolRule; now: number },
): ExcludeReason | null {
  if (!itemMatchesPersona(item.personaTags, ctx.persona)) return "persona";
  if (item.usages.some((u) => u.accountId !== ctx.accountId)) return "used_by_other";
  const mine = item.usages.filter((u) => u.accountId === ctx.accountId);
  if (mine.length) {
    if (ctx.pool.reuseCooldownDays === null) return "already_used";
    const last = Math.max(...mine.map((u) => Date.parse(u.usedAt)));
    if (ctx.now - last < ctx.pool.reuseCooldownDays * DAY) return "cooldown";
  }
  if (ctx.lastCategory && item.category && item.category === ctx.lastCategory) return "same_category";
  return null;
}

export function eligibleItems(
  items: CandidateItem[],
  ctx: { accountId: string; persona: Persona | null; lastCategory: string | null; pools: Map<string, PoolRule>; now: number },
): CandidateItem[] {
  return items.filter((i) => {
    const pool = ctx.pools.get(i.poolId);
    if (!pool || !poolMatchesPersona(pool.personaFilter, ctx.persona)) return false;
    return excludeReason(i, { ...ctx, pool }) === null;
  });
}

/** weight 가중 랜덤 (weight 1 이하는 1로 본다) */
export function weightedPick<T extends { weight: number }>(items: T[], rnd = Math.random): T | null {
  if (!items.length) return null;
  const total = items.reduce((s, i) => s + Math.max(1, i.weight), 0);
  let r = rnd() * total;
  for (const i of items) {
    r -= Math.max(1, i.weight);
    if (r < 0) return i;
  }
  return items[items.length - 1];
}

/** 재고 일수: 남은 글 ÷ 하루 소비량 */
export function stockDays(available: number, dailyNeed: number): number | null {
  if (dailyNeed <= 0) return null;
  return Math.floor(available / dailyNeed);
}
