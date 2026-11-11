import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./helpers/fake-db";

let fdb: FakeDb;
vi.mock("@/lib/db/admin", () => ({ db: () => fdb }));
vi.mock("next/server", () => ({ after: () => {} }));

const { pickPoolItem, releasePoolItem, markPoolItemUsed } = await import("@/lib/pool/pick");
const { enqueueJob, runJobs } = await import("@/lib/jobs");
const { __setProviderFactory } = await import("@/lib/ai/config");

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P = "pppppppp-pppp-4ppp-8ppp-pppppppppppp".replace(/p/g, "1");
const pool = { id: P, name: "일상 창고", persona_filter: {}, reuse_cooldown_days: null as number | null };

function item(id: string, category: string, extra: Record<string, unknown> = {}) {
  return { id, pool_id: P, text: `글 ${id}`, first_reply: null, topic_tag: null, category, weight: 1, persona_tags: [], status: "available", media: [], content_pools: pool, created_at: id, ...extra };
}

beforeEach(() => {
  fdb = new FakeDb();
  fdb.rows("threads_accounts").push({ id: A, username: "a" }, { id: B, username: "b" });
  fdb.rows("pool_accounts").push({ pool_id: P, account_id: A, content_pools: pool }, { pool_id: P, account_id: B, content_pools: pool });
  fdb.rows("pool_items").push(item("i1", "일상"), item("i2", "직장"), item("i3", "일상"));
  fdb.rows("pool_item_usage").push({ item_id: "i3", account_id: B, used_at: new Date().toISOString() });
});
afterEach(() => __setProviderFactory(null));

describe("창고 뽑기(DB)", () => {
  it("다른 계정이 쓴 글은 빼고 뽑아 reserved 로 잡는다", async () => {
    const seen = new Set<string>();
    for (let k = 0; k < 2; k++) {
      const r = await pickPoolItem(A);
      expect(r.item).not.toBeNull();
      seen.add(r.item!.id);
    }
    expect([...seen].sort()).toEqual(["i1", "i2"]); // i3 는 B 가 이미 씀, 같은 글을 두 번 주지 않음
    expect(fdb.rows("pool_items").filter((i) => i.status === "reserved").map((i) => i.reserved_account_id)).toEqual([A, A]);
    const third = await pickPoolItem(A);
    expect(third.item).toBeNull();
  });

  it("동시에 뽑아도 같은 글을 두 번 배정하지 않는다", async () => {
    const [x, y] = await Promise.all([pickPoolItem(A), pickPoolItem(B)]);
    expect(x.item && y.item && x.item.id !== y.item.id).toBe(true);
  });

  it("직전 글과 같은 분류는 피한다", async () => {
    fdb.rows("posts").push({ id: "p1", account_id: A, status: "published", pool_item_id: "i1", scheduled_at: new Date().toISOString() });
    fdb.rows("pool_items").find((i) => i.id === "i1")!.status = "used";
    const r = await pickPoolItem(A);
    expect(r.item?.id).toBe("i2");
  });

  it("돌려놓기와 사용 기록(재사용 금지 기간 없음 → used)", async () => {
    const r = await pickPoolItem(A, { excludeIds: ["i2"] });
    expect(r.item?.id).toBe("i1");
    await releasePoolItem("i1");
    expect(fdb.rows("pool_items").find((i) => i.id === "i1")).toMatchObject({ status: "available", reserved_account_id: null });
    await markPoolItemUsed("i1", A, "post-1");
    expect(fdb.rows("pool_items").find((i) => i.id === "i1")!.status).toBe("used");
    expect(fdb.rows("pool_item_usage").some((u) => u.item_id === "i1" && u.account_id === A && u.post_id === "post-1")).toBe(true);
  });

  it("재사용 금지 기간이 있으면 사용 후 다시 available(기간 동안은 규칙이 막음)", async () => {
    pool.reuse_cooldown_days = 30;
    await markPoolItemUsed("i2", A, "post-2");
    expect(fdb.rows("pool_items").find((i) => i.id === "i2")!.status).toBe("available");
    const r = await pickPoolItem(A, { excludeIds: ["i1"] });
    expect(r.item).toBeNull(); // i2 는 30일 금지, i3 는 B 것
    pool.reuse_cooldown_days = null;
  });

  it("연결 안 된 계정", async () => {
    const r = await pickPoolItem("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(r).toEqual({ item: null, reason: "이 계정에 연결된 창고가 없습니다." });
  });
});

describe("jobs: 창고 AI 일괄 생성", () => {
  it("pool_fill 작업이 검사 통과한 글만 넣고 진행률·결과를 남긴다", async () => {
    fdb.rows("content_pools").push({ ...pool });
    fdb.rows("app_settings").push({ key: "ai_defaults", value: { text: { provider: "gemini", model: "g" }, vision: { provider: "gemini", model: "g" } } });
    fdb.rows("generators").push({ id: "g1", name: "일상", kind: "daily", is_active: true, system_prompt: "S", user_prompt_template: "{{count}} {{topic}}", provider: null, model: null, example_count: 0, created_at: "1" });
    fdb.rows("topics").push({ id: "t1", category: "일상", topic: "산책", keywords: [], last_used_at: null });
    const posts = ["가".repeat(600), "비 오는 날 생각", "퇴근길 노을", "주말 대청소 후기"].map((text, i) => ({ text, first_reply: "", topic_tag: "", category: `c${i}` }));
    __setProviderFactory((name) => ({
      name,
      listModels: async () => [],
      checkModel: async () => {},
      generateJson: async (req) => ({ text: JSON.stringify({ posts: req.prompt.includes("검사에서 떨어졌습니다") ? [{ text: "새로 쓴 글", first_reply: "", topic_tag: "", category: "x" }] : posts }), model: req.model, usage: { input: 10, output: 10, cached: 0, reasoning: 0 } }),
    }));
    const jobId = await enqueueJob("pool_fill", { poolId: P, count: 4, autoApprove: false }, 4);
    fdb.rows("jobs")[0].run_after = new Date(Date.now() - 1000).toISOString();
    const r = await runJobs(Date.now() + 60_000);
    expect(r).toMatchObject({ claimed: 1, done: 1 });
    const job = fdb.rows("jobs").find((j) => j.id === jobId)!;
    expect(job.status).toBe("done");
    expect(job.result).toMatchObject({ added: 4, dropped: 0 });
    const added = fdb.rows("pool_items").filter((i) => i.source === "ai");
    expect(added.map((i) => i.text)).toEqual(["비 오는 날 생각", "퇴근길 노을", "주말 대청소 후기", "새로 쓴 글"]);
    expect(added.every((i) => i.status === "pending")).toBe(true);
  });

  it("실패하면 재시도하고 3번째에 failed + 알림", async () => {
    const jobId = await enqueueJob("pool_fill", { poolId: "없는-창고", count: 5 }, 5);
    for (let k = 0; k < 3; k++) {
      const j = fdb.rows("jobs").find((x) => x.id === jobId)!;
      j.run_after = new Date(Date.now() - 1000).toISOString();
      j.locked_until = null;
      await runJobs(Date.now() + 60_000);
    }
    const j = fdb.rows("jobs").find((x) => x.id === jobId)!;
    expect(j.status).toBe("failed");
    expect(j.attempts).toBe(3);
    expect(fdb.rows("notifications").some((n) => String(n.message).includes("창고가 삭제되었습니다"))).toBe(true);
  });
});
