import { describe, expect, it } from "vitest";
import { buildPlan, extractUrls, hasErrors, matchDisclosure, type DisclosureLite } from "@/lib/compose/plan";
import { emptyCompose, type Compose } from "@/lib/compose/schema";

const coupang: DisclosureLite = {
  id: "d1",
  name: "쿠팡",
  text: "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.",
  match_domains: ["link.coupang.com", "coupa.ng"],
  default_position: "link_reply",
};
const img = (n: number) => ({ storagePath: `uploads/x/${n}.jpg`, publicUrl: `https://e.com/${n}.jpg`, mediaType: "image" as const });
const base = (p: Partial<Compose>): Compose => ({ ...emptyCompose("a"), text: "본문", ...p });

describe("buildPlan", () => {
  it("text-only post with body link uses link_attachment", () => {
    const p = buildPlan(base({ linkUrl: "https://example.com/a", linkPosition: "body" }));
    expect(p.mediaType).toBe("TEXT");
    expect(p.mainText).toBe("본문\n\nhttps://example.com/a");
    expect(p.linkAttachment).toBe("https://example.com/a");
    expect(p.replies).toEqual([]);
  });

  it("forces link to first reply when media exists (M3 완료 기준 시나리오)", () => {
    const p = buildPlan(
      base({ media: [img(1), img(2), img(3)], linkUrl: "https://link.coupang.com/a/b", linkPosition: "body", disclosureId: "d1", disclosurePosition: "link_reply" }),
      { disclosure: coupang },
    );
    expect(p.mediaType).toBe("CAROUSEL");
    expect(p.linkPosition).toBe("first_reply");
    expect(p.linkAttachment).toBeNull();
    expect(p.mainText).toBe("본문");
    expect(p.replies).toEqual([{ kind: "link", text: `https://link.coupang.com/a/b\n\n${coupang.text}` }]);
    expect(hasErrors(p)).toBe(false);
  });

  it("appends link to existing first reply and puts separate disclosure after it", () => {
    const p = buildPlan(
      base({ replies: ["첫 댓글", "둘째"], linkUrl: "https://coupa.ng/x", linkPosition: "first_reply", disclosureId: "d1", disclosurePosition: "separate_reply" }),
      { disclosure: coupang },
    );
    expect(p.replies.map((r) => r.kind)).toEqual(["link", "disclosure", "user"]);
    expect(p.replies[0].text).toBe("첫 댓글\n\nhttps://coupa.ng/x");
    expect(p.replies[1].text).toBe(coupang.text);
  });

  it("disclosure in body counts toward 500 chars", () => {
    const p = buildPlan(base({ text: "가".repeat(470), disclosureId: "d1", disclosurePosition: "body" }), { disclosure: coupang });
    expect(p.mainText.endsWith(coupang.text)).toBe(true);
    expect(hasErrors(p)).toBe(true);
  });

  it("link_reply without a link reply falls back", () => {
    const body = buildPlan(base({ linkUrl: "https://coupa.ng/x", linkPosition: "body", disclosureId: "d1", disclosurePosition: "link_reply" }), { disclosure: coupang });
    expect(body.disclosurePosition).toBe("body");
    const none = buildPlan(base({ disclosureId: "d1", disclosurePosition: "link_reply" }), { disclosure: coupang });
    expect(none.disclosurePosition).toBe("separate_reply");
    expect(none.replies[0].kind).toBe("disclosure");
  });

  it("validates emptiness, topic tag, links, and warns", () => {
    expect(hasErrors(buildPlan(base({ text: "" })))).toBe(true);
    expect(hasErrors(buildPlan(base({ text: "", media: [img(1)] })))).toBe(false);
    expect(hasErrors(buildPlan(base({ topicTag: "a.b" })))).toBe(true);
    const many = Array.from({ length: 6 }, (_, i) => `https://s${i}.com`).join(" ");
    expect(hasErrors(buildPlan(base({ text: many })))).toBe(true);
    const warn = buildPlan(base({ text: "광고 문구", linkUrl: "https://x.com" }), { bannedWords: ["광고"] });
    expect(warn.issues.filter((i) => i.level === "warn")).toHaveLength(2);
    expect(hasErrors(warn)).toBe(false);
  });

  it("reply over 500 is an error", () => {
    expect(hasErrors(buildPlan(base({ replies: ["가".repeat(501)] })))).toBe(true);
  });
});

describe("helpers", () => {
  it("matchDisclosure by domain and subdomain", () => {
    expect(matchDisclosure("https://link.coupang.com/a", [coupang])?.id).toBe("d1");
    expect(matchDisclosure("https://www.coupa.ng/a", [coupang])?.id).toBe("d1");
    expect(matchDisclosure("https://notcoupa.ng/a", [coupang])).toBeNull();
    expect(matchDisclosure("not a url", [coupang])).toBeNull();
  });
  it("extractUrls", () => {
    expect(extractUrls("보세요 https://a.com/x, 그리고 www.b.com.")).toEqual(["https://a.com/x", "www.b.com"]);
  });
});
