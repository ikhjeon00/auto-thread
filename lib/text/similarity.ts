/** 글자 2-gram 자카드 유사도 (0~1). 공백·문장부호는 무시한다. */
function bigrams(s: string): Set<string> {
  const t = s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  const out = new Set<string>();
  const chars = Array.from(t);
  for (let i = 0; i < chars.length - 1; i++) out.add(chars[i] + chars[i + 1]);
  return out;
}

export function similarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

export const SIMILARITY_WARN = 0.5;

export function mostSimilar(text: string, others: string[]): { score: number; text: string } | null {
  let best: { score: number; text: string } | null = null;
  for (const o of others) {
    const score = similarity(text, o);
    if (!best || score > best.score) best = { score, text: o };
  }
  return best;
}
