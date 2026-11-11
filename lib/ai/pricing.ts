import type { ModelRef, Usage } from "./types";

/** 1M 토큰당 USD. 설정 > AI 에서 직접 입력한다(회사·모델마다 다르고 자주 바뀌므로) */
export type Price = { input: number; output: number; cached?: number };
export type PricingTable = Record<string, Price>;

export const priceKey = (m: ModelRef) => `${m.provider}:${m.model}`;

export function costUsd(usage: Usage, price: Price | undefined): number | null {
  if (!price) return null;
  const cached = Math.min(usage.cached, usage.input);
  const cachedPrice = price.cached ?? price.input;
  const usd = ((usage.input - cached) * price.input + cached * cachedPrice + usage.output * price.output) / 1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}
