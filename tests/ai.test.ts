import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./helpers/fake-db";
import type { AiProvider, JsonRequest } from "@/lib/ai/types";

let fdb: FakeDb;
vi.mock("@/lib/db/admin", () => ({ db: () => fdb }));

const { __setProviderFactory } = await import("@/lib/ai/config");
const { generatePosts } = await import("@/lib/ai/generate");
const { fillTemplate, describePersona } = await import("@/lib/ai/prompt");
const { validateGenerated } = await import("@/lib/ai/validate");
const { costUsd } = await import("@/lib/ai/pricing");

const ACC = "11111111-1111-4111-8111-111111111111";
type Reply = { posts: { text: string; first_reply: string; topic_tag: string; category: string }[] };
let calls: (JsonRequest & { provider: string })[] = [];
let replies: Reply[] = [];

const fakeProvider = (name: "openai" | "gemini"): AiProvider => ({
  name,
  async generateJson(req) {
    calls.push({ ...req, provider: name });
    const r = replies.shift() ?? { posts: [] };
    return { text: JSON.stringify(r), model: req.model, usage: { input: 1000, output: 500, cached: 200, reasoning: 100 } };
  },
  async listModels() {
    return [];
  },
  async checkModel() {},
});

const post = (text: string) => ({ text, first_reply: "여러분은요?", topic_tag: "#일상.", category: "일상" });

beforeEach(() => {
  fdb = new FakeDb();
  calls = [];
  replies = [];
  __setProviderFactory(fakeProvider);
  fdb.rows("app_settings").push(
    { key: "ai_defaults", value: { text: { provider: "gemini", model: "gemini-test" }, vision: { provider: "openai", model: "gpt-vision-test" } } },
    { key: "ai_pricing", value: { "gemini:gemini-test": { input: 1, output: 4, cached: 0.25 } } },
    { key: "banned_words", value: ["광고"] },
  );
  fdb.rows("generators").push(
    { id: "g1", name: "일상 주제글 메이커", kind: "daily", is_active: true, system_prompt: "SYS", user_prompt_template: "{{count}}개\n{{persona}}\n{{topic}}\n{{format}}\n{{length}}\n{{examples}}\n{{recent_posts}}", provider: null, model: null, example_count: 3, created_at: "1" },
    { id: "g2", name: "GPT 생성기", kind: "daily", is_active: true, system_prompt: "SYS2", user_prompt_template: "{{count}}", provider: "openai", model: "gpt-x", example_count: 0, created_at: "2" },
  );
  fdb.rows("personas").push({ account_id: ACC, age_group: "30s", gender: "female", job: "office", tone: "다정한 반말" });
  fdb.rows("topics").push({ id: "t1", category: "직장", topic: "회의가 너무 많은 날", keywords: ["회의"], last_used_at: null });
  fdb.rows("post_formats").push({ name: "질문형", instruction: "질문으로 끝낸다", is_active: true });
  fdb.rows("posts").push({ id: "p0", account_id: ACC, status: "published", text: "오늘 회의만 다섯 개였다 진짜 너무 힘들다", created_at: "1" });
});
afterEach(() => __setProviderFactory(null));

describe("generatePosts", () => {
  it("조립한 프롬프트로 기본 모델을 부르고 비용을 기록한다", async () => {
    replies = [{ posts: [post("점심 메뉴 고르는 게 제일 어려워"), post("퇴근길 노을이 예뻤다")] }];
    const r = await generatePosts({ accountId: ACC, kind: "general", count: 2, purpose: "compose" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ provider: "gemini", model: "gemini-test", schemaName: "threads_posts" });
    expect(calls[0].system).toContain("SYS");
    expect(calls[0].system).toContain("[공통 규칙]");
    expect(calls[0].prompt).toContain("30대 여자 직장인");
    expect(calls[0].prompt).toContain("다정한 반말");
    expect(calls[0].prompt).toContain("직장 — 회의가 너무 많은 날");
    expect(calls[0].prompt).toContain("질문형");
    expect(calls[0].prompt).toContain("오늘 회의만 다섯 개였다");
    expect(r.posts.map((p) => p.issues)).toEqual([[], []]);
    expect(r.posts[0].topic_tag).toBe("일상"); // # 과 . 제거
    // (1000-200)*1 + 200*0.25 + 500*4 = 2850 / 1M
    expect(r.meta.costUsd).toBeCloseTo(0.00285, 6);
    expect(fdb.rows("generation_logs")[0]).toMatchObject({ provider: "gemini", model: "gemini-test", input_tokens: 1000, output_tokens: 500, purpose: "compose" });
    expect(fdb.rows("topics")[0].last_used_at).toBeTruthy();
  });

  it("검사에 실패한 글만 다시 만든다", async () => {
    replies = [
      { posts: [post("좋은 글 하나"), post("가".repeat(600)), post("광고 같은 글")] },
      { posts: [post("다시 쓴 글 둘"), post("다시 쓴 글 셋 완전히 다른 이야기")] },
    ];
    const r = await generatePosts({ accountId: ACC, kind: "general", count: 3, purpose: "compose" });
    expect(calls).toHaveLength(2);
    expect(calls[1].prompt).toContain("새로 2개");
    expect(calls[1].prompt).toMatch(/500자 초과|금칙어/);
    expect(r.posts.map((p) => p.text)).toEqual(["좋은 글 하나", "다시 쓴 글 둘", "다시 쓴 글 셋 완전히 다른 이야기"]);
    expect(r.posts.every((p) => !p.issues.length)).toBe(true);
    expect(fdb.rows("generation_logs")).toHaveLength(2);
  });

  it("최근 글과 비슷한 글은 문제 표시를 남긴다", async () => {
    replies = [{ posts: [post("오늘 회의만 다섯 개였다 진짜 너무 힘들다!")] }, { posts: [post("오늘 회의만 다섯 개였다 진짜 너무 힘들다!!")] }];
    const r = await generatePosts({ accountId: ACC, kind: "general", count: 1, purpose: "compose" });
    expect(r.posts[0].issues[0]).toContain("최근 글과 비슷함");
  });

  it("생성기에 지정한 회사·모델과 사용자가 정한 주제를 쓴다", async () => {
    replies = [{ posts: [post("글")] }];
    const r = await generatePosts({ accountId: ACC, generatorId: "g2", kind: "general", topic: "무선 청소기", count: 1, purpose: "compose" });
    expect(calls[0]).toMatchObject({ provider: "openai", model: "gpt-x" });
    expect(r.meta.topic).toBe("무선 청소기");
    expect(r.meta.costUsd).toBeNull(); // 단가 미입력
  });

  it("기본 모델이 없으면 알기 쉬운 오류 + 활동 알림", async () => {
    fdb.rows("app_settings")[0].value = { text: { provider: "gemini", model: "" }, vision: { provider: "gemini", model: "" } };
    await expect(generatePosts({ accountId: ACC, kind: "general", count: 1, purpose: "compose" })).rejects.toThrow(/기본 모델/);
  });

  it("JSON 이 아니면 실패를 알린다", async () => {
    __setProviderFactory((name) => ({ ...fakeProvider(name), generateJson: async (req) => ({ text: "not json", model: req.model, usage: { input: 1, output: 1, cached: 0, reasoning: 0 } }) }));
    await expect(generatePosts({ accountId: ACC, kind: "general", count: 1, purpose: "compose" })).rejects.toThrow(/해석하지 못했습니다/);
    expect(fdb.rows("notifications").some((n) => n.type === "ai_error")).toBe(true);
  });
});

describe("prompt & helpers", () => {
  it("fillTemplate leaves unknown vars, appends extra", () => {
    const s = fillTemplate("{{count}} {{unknown}} {{examples}}", { count: 3, persona: null, topic: "", format: "", length: "", examples: [], recentPosts: [], extra: "추가" });
    expect(s).toBe("3 {{unknown}} (예시 없음)\n\n[추가 요청]\n추가");
    expect(describePersona({ age_group: "any", gender: "any", job: "any", tone: null })).toBe("연령·성별·직업 무관");
  });
  it("validateGenerated flags hashtags and duplicates", () => {
    const v = validateGenerated(
      [{ text: "주말 산책 #일상", first_reply: "", topic_tag: "", category: "" }, { text: "비 오는 날 커피", first_reply: "", topic_tag: "", category: "" }, { text: "비 오는 날 커피!", first_reply: "", topic_tag: "", category: "" }],
      { recent: [], banned: [] },
    );
    expect(v[0].issues).toContain("해시태그 포함");
    expect(v[1].issues).toEqual([]);
    expect(v[2].issues).toContain("같이 만든 글과 비슷함");
  });
  it("costUsd", () => {
    expect(costUsd({ input: 1_000_000, output: 1_000_000, cached: 0, reasoning: 0 }, { input: 1, output: 2 })).toBe(3);
    expect(costUsd({ input: 1, output: 1, cached: 0, reasoning: 0 }, undefined)).toBeNull();
  });
});

describe("API 키 저장", () => {
  it("설정에서 등록한 키는 암호화돼 저장되고 환경변수보다 우선한다", async () => {
    const { randomBytes } = await import("node:crypto");
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.GEMINI_API_KEY = "env-gemini-key-1234";
    const { saveStoredKey, getApiKey, keyStatuses } = await import("@/lib/ai/config");

    expect(await getApiKey("gemini")).toBe("env-gemini-key-1234");
    expect((await keyStatuses()).gemini).toMatchObject({ source: "env", last4: "1234" });
    expect(await getApiKey("openai")).toBeNull();

    await saveStoredKey("gemini", "AIza-settings-key-9876");
    const raw = JSON.stringify(fdb.rows("app_settings").find((r) => r.key === "ai_keys")!.value);
    expect(raw).not.toContain("AIza-settings-key"); // 평문 저장 금지
    expect(await getApiKey("gemini")).toBe("AIza-settings-key-9876");
    expect((await keyStatuses()).gemini).toMatchObject({ source: "settings", last4: "9876" });

    await saveStoredKey("gemini", null);
    expect(await getApiKey("gemini")).toBe("env-gemini-key-1234");
    delete process.env.GEMINI_API_KEY;
  });
});

describe("모델 목록", () => {
  it("Gemini 는 3 버전 이상만, 최신순", async () => {
    const { filterGeminiModels } = await import("@/lib/ai/models");
    expect(
      filterGeminiModels(["gemini-2.5-flash", "gemini-3.8-flash", "gemini-3-pro", "gemma-3-27b", "gemini-4.0-flash", "gemini-3.8-flash", "gemini-1.5-pro"]),
    ).toEqual(["gemini-4.0-flash", "gemini-3.8-flash", "gemini-3-pro"]);
  });
});
