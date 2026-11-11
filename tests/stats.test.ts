import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./helpers/fake-db";

let fdb: FakeDb;
vi.mock("@/lib/db/admin", () => ({ db: () => fdb }));
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const { encryptToken } = await import("@/lib/crypto/token");
const { syncAccounts, syncPosts } = await import("@/lib/stats/sync");
const { insightValue } = await import("@/lib/threads/client");
const { todayKst, addDays } = await import("@/lib/calendar");

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const calls: string[] = [];
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  fdb = new FakeDb();
  calls.length = 0;
  fdb.rows("threads_accounts").push({ id: A, threads_user_id: "1001", username: "old", status: "active", access_token_enc: encryptToken("tok") });
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(url.pathname + "?" + url.searchParams.get("metric"));
    if (url.pathname.endsWith("/threads_insights")) {
      const metric = url.searchParams.get("metric")!;
      if (metric === "followers_count") return json({ data: [{ name: "followers_count", period: "day", total_value: { value: 1234 } }] });
      const today = Number(url.searchParams.get("since")) > Date.now() / 1000 - 86400;
      return json({
        data: [
          { name: "views", period: "day", values: [{ value: today ? 5 : 10 }, { value: today ? 0 : 20 }] },
          { name: "likes", period: "day", total_value: { value: today ? 3 : 7 } },
          { name: "replies", period: "day", total_value: { value: 1 } },
          { name: "reposts", period: "day", total_value: { value: 0 } },
          { name: "quotes", period: "day", total_value: { value: 0 } },
          { name: "clicks", period: "day", link_total_values: [{ value: 4, link_url: "a" }, { value: 2, link_url: "b" }] },
        ],
      });
    }
    if (url.pathname === "/v1.0/me") return json({ id: "1001", username: "new_name", threads_profile_picture_url: "https://cdn/p.jpg" });
    if (url.pathname.endsWith("/insights")) {
      return json({ data: ["views", "likes", "replies", "reposts", "quotes", "shares"].map((name, i) => ({ name, period: "lifetime", values: [{ value: (i + 1) * 10 }] })) });
    }
    return json({ error: { message: "unhandled", code: 0 } }, 404);
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("통계 수집", () => {
  it("계정: 오늘·어제 지표와 팔로워 스냅샷, 프로필 갱신", async () => {
    const r = await syncAccounts(Date.now() + 20_000);
    expect(r).toMatchObject({ accounts: 1, ok: 1, failed: 0 });
    const rows = fdb.rows("account_daily_stats");
    const today = rows.find((x) => x.date === todayKst())!;
    const yest = rows.find((x) => x.date === addDays(todayKst(), -1))!;
    expect(today).toMatchObject({ views: 5, likes: 3, replies: 1, clicks: 6, followers: 1234 });
    expect(yest).toMatchObject({ views: 30, likes: 7, followers: 1234 }); // 어제 행이 없었으니 채움
    expect(fdb.rows("threads_accounts")[0]).toMatchObject({ follower_count: 1234, username: "new_name", profile_picture_url: "https://cdn/p.jpg" });
  });

  it("게시물: 최근 30일 발행 글 인사이트 저장", async () => {
    fdb.rows("posts").push({
      id: "p1",
      status: "published",
      threads_media_id: "m1",
      account_id: A,
      published_at: new Date().toISOString(),
      threads_accounts: fdb.rows("threads_accounts")[0],
      post_insights: null,
    });
    const r = await syncPosts(Date.now() + 20_000);
    expect(r).toMatchObject({ posts: 1, ok: 1 });
    expect(fdb.rows("post_insights")[0]).toMatchObject({ post_id: "p1", views: 10, likes: 20, replies: 30, reposts: 40, quotes: 50, shares: 60 });
  });

  it("insightValue 형식 3가지", () => {
    expect(insightValue({ name: "x", total_value: { value: 7 } })).toBe(7);
    expect(insightValue({ name: "x", values: [{ value: 1 }, { value: 2 }] })).toBe(3);
    expect(insightValue({ name: "x", link_total_values: [{ value: 4 }, { value: 5 }] })).toBe(9);
    expect(insightValue(undefined)).toBe(0);
  });
});
