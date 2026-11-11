/** 프롬프트 조립(순수 함수). 작업지시서 8장 "AI 생성" */
import type { JsonSchema } from "./types";

export type PersonaLite = { age_group: string | null; gender: string | null; job: string | null; tone: string | null };

export const AGE_LABEL: Record<string, string> = { "20s": "20대", "30s": "30대", "40s_early": "40대 초반", "40s_late": "40대 후반", any: "무관" };
export const GENDER_LABEL: Record<string, string> = { male: "남자", female: "여자", any: "무관" };
export const JOB_LABEL: Record<string, string> = { office: "직장인", self_employed: "자영업", business: "사업", homemaker: "주부", any: "무관" };

export const LENGTHS = [
  { key: "short", label: "짧게", instruction: "짧게: 1~3문장, 120자 안팎" },
  { key: "medium", label: "보통", instruction: "보통: 150~250자" },
  { key: "long", label: "길게", instruction: "길게: 300~450자, 줄바꿈으로 단락을 나눔" },
] as const;

export function describePersona(p: PersonaLite | null): string {
  if (!p) return "특별한 설정 없음. 평범한 한국인 개인 계정.";
  const parts = [
    p.age_group && p.age_group !== "any" ? AGE_LABEL[p.age_group] : null,
    p.gender && p.gender !== "any" ? GENDER_LABEL[p.gender] : null,
    p.job && p.job !== "any" ? JOB_LABEL[p.job] : null,
  ].filter(Boolean);
  const who = parts.length ? parts.join(" ") : "연령·성별·직업 무관";
  return `${who}${p.tone?.trim() ? `\n말투: ${p.tone.trim()}` : ""}`;
}

const list = (items: string[], empty: string) =>
  items.length ? items.map((t, i) => `${i + 1}. ${t.replace(/\s+/g, " ").slice(0, 300)}`).join("\n") : empty;

export type PromptVars = {
  count: number;
  persona: PersonaLite | null;
  topic: string;
  format: string;
  length: string;
  examples: string[];
  recentPosts: string[];
  extra?: string;
};

export function fillTemplate(template: string, v: PromptVars): string {
  const map: Record<string, string> = {
    count: String(v.count),
    persona: describePersona(v.persona),
    topic: v.topic,
    format: v.format,
    length: v.length,
    examples: list(v.examples, "(예시 없음)"),
    recent_posts: list(v.recentPosts, "(최근 글 없음)"),
  };
  let out = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in map ? map[k] : m));
  if (v.extra) out += `\n\n[추가 요청]\n${v.extra}`;
  return out;
}

/** 모든 생성기에 공통으로 붙는 규칙(시스템 프롬프트 뒤). 고정 문구라 앞부분 캐시에 유리 */
export const COMMON_RULES = `
[공통 규칙]
- 결과는 지정된 JSON 형식으로만 답한다.
- text 는 500자 이하(이모지는 4자로 계산). 해시태그 금지.
- 서로 다른 글끼리 첫 문장과 소재가 겹치지 않게 한다.
- 실제 사람이 쓴 것처럼 자연스럽게. AI·챗봇이라는 언급 금지.`;

export const POSTS_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    posts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "Threads 본문" },
          first_reply: { type: "string", description: "첫 댓글. 없으면 빈 문자열" },
          topic_tag: { type: "string", description: "커뮤니티 주제 한 단어(# 없이)" },
          category: { type: "string", description: "분류" },
        },
        required: ["text", "first_reply", "topic_tag", "category"],
        additionalProperties: false,
      },
    },
  },
  required: ["posts"],
  additionalProperties: false,
};

export function pickRandom<T>(arr: T[], rnd = Math.random): T | undefined {
  return arr.length ? arr[Math.floor(rnd() * arr.length)] : undefined;
}

export function sample<T>(arr: T[], n: number, rnd = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
