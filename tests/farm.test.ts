import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./helpers/fake-db";
import { FakeThreads } from "./helpers/fake-threads";
import type { JsonRequest } from "@/lib/ai/types";

let fdb: FakeDb;
vi.mock("@/lib/db/admin", () => ({ db: () => fdb }));
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const { encryptToken } = await import("@/lib/crypto/token");
const { enqueueJob, runJobs } = await import("@/lib/jobs");
const { __setProviderFactory } = await import("@/lib/ai/config");
const { runPublishBatch } = await import("@/lib/publisher");
const { addDays, todayKst } = await import("@/lib/calendar");

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DISC = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const POOL = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const tomorrow = addDays(todayKst(), 1);
let aiCalls: JsonRequest[] = [];
let n = 0;

function campaign(id: string, account: string, cfg: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    id,
    account_id: account,
    kind: cfg.kind,
    start_date: tomorrow,
    days: 2,
    daily_count: 2,
    active_start: "08:00:00",
    active_end: "23:00:00",
    pool_id: null,
    mode: "auto",
    status: "draft",
    batch_id: "batch-1",
    config: {
      kind: "growth",
      dailyGeneralCount: 2,
      dailyProductCount: 0,
      generalSource: "ai",
      poolId: null,
      assignTiming: "pre",
      generatorId: null,
      productGeneratorId: null,
      productIds: [],
      useVision: false,
      isAiLabel: true,
      mode: "auto",
      phase: "slots",
      ...cfg,
    },
    ...extra,
  };
}

beforeEach(() => {
  fdb = new FakeDb();
  aiCalls = [];
  for (const [id, uid, name] of [
    [A, "1001", "alpha"],
    [B, "1002", "beta"],
  ]) {
    fdb.rows("threads_accounts").push({ id, threads_user_id: uid, username: name, status: "active", daily_post_limit: 10, access_token_enc: encryptToken("t"), token_expires_at: new Date(Date.now() + 9e9).toISOString() });
  }
  fdb.rows("app_settings").push({ key: "ai_defaults", value: { text: { provider: "gemini", model: "g" }, vision: { provider: "openai", model: "v" } } });
  fdb.rows("generators").push(
    { id: "11111111-0000-4000-8000-000000000001", name: "일상", kind: "daily", is_active: true, system_prompt: "S", user_prompt_template: "{{count}}|{{topic}}", provider: null, model: null, example_count: 0, created_at: "1" },
    { id: "11111111-0000-4000-8000-000000000002", name: "상품", kind: "product", is_active: true, system_prompt: "S", user_prompt_template: "{{count}}|{{topic}}", provider: null, model: null, example_count: 0, created_at: "2" },
  );
  fdb.rows("disclosures").push({ id: DISC, name: "쿠팡", text: "쿠팡 고지 문구", match_domains: ["link.coupang.com"], is_default: true, default_position: "link_reply" });
  __setProviderFactory((name) => ({
    name,
    listModels: async () => [],
    checkModel: async () => {},
    generateJson: async (req) => {
      aiCalls.push(req);
      const count = Number(req.prompt.split("|")[0]);
      const posts = Array.from({ length: count }, () => ({ text: `생성된 글 ${++n} ${"가나다라마바사".repeat(n % 5)} ${n * 7919}`, first_reply: "첫 댓글", topic_tag: "일상", category: "c" }));
      return { text: JSON.stringify({ posts }), model: req.model, usage: { input: 1, output: 1, cached: 0, reasoning: 0 } };
    },
  }));
});
afterEach(() => __setProviderFactory(null));

async function runBuild() {
  const jobId = await enqueueJob("farm_build", { batchId: "batch-1" }, 0);
  fdb.rows("jobs").find((j) => j.id === jobId)!.run_after = new Date(Date.now() - 1000).toISOString();
  for (let k = 0; k < 5; k++) {
    const j = fdb.rows("jobs").find((x) => x.id === jobId)!;
    if (j.status === "done" || j.status === "failed") break;
    j.locked_until = null;
    j.run_after = new Date(Date.now() - 1000).toISOString();
    await runJobs(Date.now() + 250_000);
  }
  return fdb.rows("jobs").find((x) => x.id === jobId)!;
}

describe("계정 키우기 농장", () => {
  it("AI·자동 모드: 시간 배치 후 글을 채워 예약한다", async () => {
    fdb.rows("campaigns").push(campaign("c1", A, {}), campaign("c2", B, {}));
    const job = await runBuild();
    expect(job.status).toBe("done");
    const posts = fdb.rows("posts");
    expect(posts).toHaveLength(8); // 2계정 × 2일 × 2개
    expect(posts.every((p) => p.status === "scheduled" && String(p.text).startsWith("생성된 글"))).toBe(true);
    expect(posts.every((p) => p.is_ai_label === true && p.campaign_id)).toBe(true);
    expect(posts.every((p) => String(p.scheduled_at) > new Date().toISOString())).toBe(true);
    expect(fdb.rows("post_replies").filter((r) => r.text === "첫 댓글")).toHaveLength(8);
    expect(fdb.rows("campaigns").every((c) => (c.config as { phase: string }).phase === "done" && c.status === "active")).toBe(true);
    expect(job.result).toMatchObject({ posts: 8, skipped: 0 });
    // 같은 계정 60분, 계정 간 3분
    const sorted = posts.map((p) => ({ a: p.account_id, t: Date.parse(String(p.scheduled_at)) })).sort((x, y) => x.t - y.t);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].t - sorted[i - 1].t).toBeGreaterThanOrEqual(3 * 60_000);
    expect(aiCalls.every((c) => !c.images)).toBe(true);
  });
});

describe("수익화 농장", () => {
  it("검토 모드: 상품 사진을 보고 쓰고, 링크·고지 문구는 서버가 첫 댓글에 붙인다", async () => {
    const media = [{ storagePath: "products/x/1.jpg", publicUrl: "https://e.com/p1.jpg", mediaType: "image" }];
    fdb.rows("products").push({ id: PROD, name: "무선 청소기", affiliate_url: "https://link.coupang.com/a/xyz", disclosure_id: null, media, memo: "1.2kg 가벼움" });
    fdb.rows("campaigns").push(
      campaign("c1", A, { kind: "monetize", dailyGeneralCount: 1, dailyProductCount: 1, productIds: [PROD], useVision: true, mode: "review", productGeneratorId: "11111111-0000-4000-8000-000000000002" }, { mode: "review", days: 1 }),
    );
    fdb.rows("campaigns")[0].days = 1;
    const job = await runBuild();
    expect(job.status).toBe("done");
    const posts = fdb.rows("posts");
    expect(posts).toHaveLength(2);
    expect(posts.every((p) => p.status === "review")).toBe(true);
    const product = posts.find((p) => p.kind === "product")!;
    expect(product.link_url).toBe("https://link.coupang.com/a/xyz");
    expect(product.disclosure_position).toBe("reply_top");
    const replies = fdb.rows("post_replies").filter((r) => r.post_id === product.id);
    expect(replies[0].text).toBe("쿠팡 고지 문구\n\n첫 댓글\n\nhttps://link.coupang.com/a/xyz");
    expect(replies[0].media_url).toBe("https://e.com/p1.jpg"); // 첫 댓글 사진 → 링크 미리보기 카드 없음
    expect(fdb.rows("post_media").filter((m) => m.post_id === product.id)).toHaveLength(1);
    const visionCall = aiCalls.find((c) => c.images?.length);
    expect(visionCall?.images).toEqual([{ url: "https://e.com/p1.jpg" }]);
    expect(visionCall?.model).toBe("v"); // 사진 이해용 기본 모델
    expect(visionCall?.prompt).toContain("무선 청소기");
    expect(visionCall?.prompt).toContain("1.2kg 가벼움");
  });
});

describe("창고 발행 직전 뽑기", () => {
  it("자리만 예약해 두었다가 발행할 때 창고 글을 뽑아 올린다", async () => {
    const pool = { id: POOL, name: "창고", persona_filter: {}, reuse_cooldown_days: null };
    fdb.rows("pool_accounts").push({ pool_id: POOL, account_id: A, content_pools: pool });
    fdb.rows("pool_items").push({
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      pool_id: POOL,
      text: "창고 글",
      first_reply: null,
      topic_tag: null,
      category: "x",
      weight: 1,
      persona_tags: [],
      status: "available",
      media: [],
      content_pools: pool,
      compose: { kind: "general", text: "창고에서 뽑은 글", replies: [{ text: "창고 댓글", media: null }] },
    });
    fdb.rows("campaigns").push(campaign("c1", A, { generalSource: "pool", poolId: POOL, assignTiming: "at_publish", dailyGeneralCount: 1 }, { days: 1 }));
    fdb.rows("campaigns")[0].days = 1;
    const job = await runBuild();
    expect(job.status).toBe("done");
    const post = fdb.rows("posts")[0];
    expect(post).toMatchObject({ status: "scheduled", text: "" });
    expect((post.ai_meta as { farm: { pickAtPublish: boolean } }).farm.pickAtPublish).toBe(true);
    expect(aiCalls).toHaveLength(0);

    // 발행 시간이 됨
    post.scheduled_at = new Date(Date.now() - 1000).toISOString();
    const api = new FakeThreads();
    vi.stubGlobal("fetch", api.fetch);
    await runPublishBatch(Date.now() + 45_000);
    vi.unstubAllGlobals();
    const after = fdb.rows("posts")[0];
    expect(after.status).toBe("published");
    expect(after.text).toBe("창고에서 뽑은 글");
    expect(api.created((p) => p.text === "창고 댓글")).toHaveLength(1);
    expect(fdb.rows("pool_items")[0].status).toBe("used");
  });
});
