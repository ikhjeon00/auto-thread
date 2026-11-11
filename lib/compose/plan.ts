/**
 * 작성 내용 → 실제로 발행할 형태(본문 + 댓글 목록)로 바꾸는 순수 함수.
 * 작성 화면(미리보기·검사)과 서버(저장·발행)가 같은 함수를 쓴다.
 */
import { THREADS_TEXT_LIMIT, countThreadsChars } from "@/lib/threads/text";
import type { Compose, DisclosurePosition, LinkPosition, MediaItem } from "./schema";

export type DisclosureLite = { id: string; name: string; text: string; match_domains: string[]; default_position: DisclosurePosition };

export type PlannedReply = { text: string; kind: "user" | "link" | "disclosure"; media: MediaItem | null };

export type Issue = { level: "error" | "warn"; field: string; message: string };

/** reply_top: 첫 댓글 맨 앞 (상품 홍보글 전용) */
export type PlanDisclosurePosition = DisclosurePosition | "reply_top";

export type PublishPlan = {
  mainText: string;
  linkAttachment: string | null;
  linkPosition: LinkPosition | null;
  disclosurePosition: PlanDisclosurePosition | null;
  mediaType: "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";
  replies: PlannedReply[];
  issues: Issue[];
};

export const MAX_LINKS = 5;
const URL_RE = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/gi;

export function extractUrls(text: string): string[] {
  return (text.match(URL_RE) ?? []).map((u) => u.replace(/[.,!?)]+$/, ""));
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** 링크 도메인이 고지 문구의 match_domains 와 맞으면 그 문구를 돌려준다 */
export function matchDisclosure(linkUrl: string | null, disclosures: DisclosureLite[]): DisclosureLite | null {
  const host = hostOf(linkUrl);
  if (!host) return null;
  return (
    disclosures.find((d) =>
      d.match_domains.some((m) => {
        const dm = m.toLowerCase().replace(/^www\./, "");
        return host === dm || host.endsWith(`.${dm}`);
      }),
    ) ?? null
  );
}

const join = (a: string, b: string) => (a ? `${a}\n\n${b}` : b);

export function validateTopicTag(tag: string | null): string | null {
  if (!tag) return null;
  if (tag.length > 50) return "커뮤니티 주제는 50자 이하여야 합니다.";
  if (/[.&]/.test(tag)) return "커뮤니티 주제에는 마침표(.)와 &를 쓸 수 없습니다.";
  return null;
}

export function buildPlan(
  c: Compose,
  opts: { disclosure?: DisclosureLite | null; bannedWords?: string[] } = {},
): PublishPlan {
  const issues: Issue[] = [];
  const hasMedia = c.media.length > 0;
  const link = c.linkUrl;
  const disclosure = c.disclosureId ? (opts.disclosure ?? null) : null;

  // 미디어가 있으면 link_attachment 가 동작하지 않으므로 링크는 첫 댓글로
  const linkPosition: LinkPosition | null = link ? (hasMedia ? "first_reply" : c.linkPosition) : null;

  let mainText = c.text.trim();
  const replies: PlannedReply[] = c.replies
    .map((r) => ({ text: r.text.trim(), kind: "user" as const, media: r.media ?? null }))
    .filter((r) => r.text || r.media);
  let linkReplyIdx = -1;

  if (link) {
    if (linkPosition === "body") {
      mainText = join(mainText, link);
    } else if (replies.length > 0) {
      replies[0] = { ...replies[0], text: join(replies[0].text, link), kind: "link" };
      linkReplyIdx = 0;
    } else {
      replies.unshift({ text: link, kind: "link", media: null });
      linkReplyIdx = 0;
    }
  }

  let disclosurePosition: PlanDisclosurePosition | null = null;
  if (disclosure && c.kind === "product") {
    // 상품 홍보글: 고지 문구를 첫 댓글 맨 앞에 → "고지 문구 + 댓글 내용(+ 링크)"
    disclosurePosition = "reply_top";
    if (replies.length > 0) {
      replies[0] = { ...replies[0], text: join(disclosure.text, replies[0].text) };
    } else {
      replies.unshift({ text: disclosure.text, kind: "disclosure", media: null });
    }
  } else if (disclosure) {
    disclosurePosition = c.disclosurePosition;
    // 링크 댓글이 없으면 '링크 댓글' 위치는 링크가 있는 곳(본문) 또는 별도 댓글로 바꾼다
    if (disclosurePosition === "link_reply" && linkReplyIdx < 0) {
      disclosurePosition = linkPosition === "body" ? "body" : "separate_reply";
    }
    if (disclosurePosition === "body") {
      mainText = join(mainText, disclosure.text);
    } else if (disclosurePosition === "link_reply") {
      replies[linkReplyIdx] = { ...replies[linkReplyIdx], text: join(replies[linkReplyIdx].text, disclosure.text) };
    } else {
      replies.splice(linkReplyIdx >= 0 ? linkReplyIdx + 1 : 0, 0, { text: disclosure.text, kind: "disclosure", media: null });
    }
  }

  // 첫 댓글에 본문 첫 사진 붙이기 (댓글에 직접 넣은 사진이 있으면 그것을 우선)
  if (c.firstReplyMainMedia && hasMedia && replies.length > 0 && !replies[0].media) {
    replies[0] = { ...replies[0], media: c.media[0] };
  }

  const mediaType: PublishPlan["mediaType"] = !hasMedia
    ? "TEXT"
    : c.media.length === 1
      ? c.media[0].mediaType === "video"
        ? "VIDEO"
        : "IMAGE"
      : "CAROUSEL";

  // ---- 검사
  const mainCount = countThreadsChars(mainText);
  if (!mainText && !hasMedia) issues.push({ level: "error", field: "text", message: "본문을 입력하세요." });
  if (mainCount > THREADS_TEXT_LIMIT) {
    issues.push({
      level: "error",
      field: "text",
      message: `본문이 ${THREADS_TEXT_LIMIT}자를 넘었습니다(${mainCount}자${disclosurePosition === "body" || linkPosition === "body" ? ", 링크·고지 문구 포함" : ""}).`,
    });
  }
  replies.forEach((r, i) => {
    const n = countThreadsChars(r.text);
    if (n > THREADS_TEXT_LIMIT) issues.push({ level: "error", field: `reply.${i}`, message: `${i + 1}번째 댓글이 ${THREADS_TEXT_LIMIT}자를 넘었습니다(${n}자).` });
  });
  const linkAttachment = link && linkPosition === "body" && !hasMedia ? link : null;
  const textOnlyLinkReply = replies.findIndex((r) => !r.media && extractUrls(r.text).length > 0);
  if (textOnlyLinkReply >= 0) {
    issues.push({
      level: "warn",
      field: `reply.${textOnlyLinkReply}`,
      message: `${textOnlyLinkReply + 1}번째 댓글은 글자만 있어서 링크 미리보기 카드가 붙습니다. 사진을 붙이면 링크만 표시됩니다.`,
    });
  }
  const uniqueLinks = new Set([...extractUrls(mainText), ...(linkAttachment ? [linkAttachment] : [])]);
  if (uniqueLinks.size > MAX_LINKS) {
    issues.push({ level: "error", field: "text", message: `본문의 링크는 ${MAX_LINKS}개 이하여야 합니다(현재 ${uniqueLinks.size}개).` });
  }
  const tagErr = validateTopicTag(c.topicTag);
  if (tagErr) issues.push({ level: "error", field: "topicTag", message: tagErr });
  if (c.media.length > 20) issues.push({ level: "error", field: "media", message: "사진·영상은 최대 20개입니다." });

  if (c.kind === "product" && !disclosure) {
    issues.push({ level: "warn", field: "disclosure", message: "상품 홍보글입니다. 제휴 고지 문구를 선택하세요." });
  } else if (link && !disclosure) {
    issues.push({ level: "warn", field: "disclosure", message: "링크가 있는데 제휴 고지 문구가 없습니다. 제휴 링크라면 고지 문구를 넣으세요." });
  }
  const banned = (opts.bannedWords ?? []).map((w) => w.trim()).filter(Boolean);
  if (banned.length) {
    const all = [mainText, ...replies.map((r) => r.text)].join("\n").toLowerCase();
    const hits = banned.filter((w) => all.includes(w.toLowerCase()));
    if (hits.length) issues.push({ level: "warn", field: "text", message: `금칙어가 들어 있습니다: ${hits.join(", ")}` });
  }

  return { mainText, linkAttachment, linkPosition, disclosurePosition, mediaType, replies, issues };
}

export const hasErrors = (p: PublishPlan) => p.issues.some((i) => i.level === "error");
