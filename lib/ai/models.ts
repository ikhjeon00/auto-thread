/** 모델 목록 정리(순수 함수) */

/** "gemini-3.8-flash" → 3.8, 버전이 없으면 null */
export function geminiVersion(name: string): number | null {
  const m = /^gemini-(\d+(?:\.\d+)?)/.exec(name);
  return m ? Number(m[1]) : null;
}

/** Gemini: 3 버전 이상만, 최신 버전부터 */
export function filterGeminiModels(names: string[], minVersion = 3): string[] {
  return [...new Set(names)]
    .filter((n) => (geminiVersion(n) ?? 0) >= minVersion)
    .sort((a, b) => geminiVersion(b)! - geminiVersion(a)! || a.localeCompare(b));
}
