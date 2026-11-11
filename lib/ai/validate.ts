/** 생성된 글 검사(순수 함수): 길이, 금칙어, 최근 글·서로 간 유사도 */
import { z } from "zod";
import { THREADS_TEXT_LIMIT, countThreadsChars } from "@/lib/threads/text";
import { SIMILARITY_WARN, similarity } from "@/lib/text/similarity";

export const generatedPostSchema = z.object({
  text: z.string(),
  first_reply: z.string().default(""),
  topic_tag: z.string().default(""),
  category: z.string().default(""),
});
export const generatedSchema = z.object({ posts: z.array(generatedPostSchema) });
export type GeneratedRaw = z.infer<typeof generatedPostSchema>;
export type GeneratedPost = GeneratedRaw & { issues: string[] };

export function cleanTopicTag(tag: string): string {
  return tag.replace(/^#/, "").replace(/[.&]/g, "").trim().slice(0, 50);
}

export function validateGenerated(posts: GeneratedRaw[], opts: { recent: string[]; banned: string[]; accepted?: string[] }): GeneratedPost[] {
  const accepted = [...(opts.accepted ?? [])];
  return posts.map((p) => {
    const text = p.text.trim();
    const issues: string[] = [];
    if (!text) issues.push("본문이 비어 있음");
    const n = countThreadsChars(text);
    if (n > THREADS_TEXT_LIMIT) issues.push(`본문 ${n}자로 ${THREADS_TEXT_LIMIT}자 초과`);
    if (countThreadsChars(p.first_reply) > THREADS_TEXT_LIMIT) issues.push("첫 댓글 500자 초과");
    if (/(^|\s)#[^\s#]+/.test(text)) issues.push("해시태그 포함");
    const lower = `${text}\n${p.first_reply}`.toLowerCase();
    const hits = opts.banned.filter((w) => w.trim() && lower.includes(w.trim().toLowerCase()));
    if (hits.length) issues.push(`금칙어: ${hits.join(", ")}`);
    const simRecent = opts.recent.find((r) => similarity(text, r) >= SIMILARITY_WARN);
    if (simRecent) issues.push(`최근 글과 비슷함: “${simRecent.slice(0, 30)}…”`);
    if (accepted.some((a) => similarity(text, a) >= SIMILARITY_WARN)) issues.push("같이 만든 글과 비슷함");
    if (!issues.length) accepted.push(text);
    return { text, first_reply: p.first_reply.trim(), topic_tag: cleanTopicTag(p.topic_tag), category: p.category.trim(), issues };
  });
}
