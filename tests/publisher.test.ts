import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./helpers/fake-db";
import { FakeThreads } from "./helpers/fake-threads";

let fdb: FakeDb;
vi.mock("@/lib/db/admin", () => ({ db: () => fdb }));

process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const { encryptToken } = await import("@/lib/crypto/token");
const { runPublishBatch } = await import("@/lib/publisher");
const { savePost } = await import("@/lib/compose/save");

const ACC = "11111111-1111-4111-8111-111111111111";
const ACC2 = "22222222-2222-4222-8222-222222222222";
const DISC = "33333333-3333-4333-8333-333333333333";
const DISC_TEXT = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
let api: FakeThreads;

const past = (s = 60) => new Date(Date.now() - s * 1000).toISOString();
const deadline = () => Date.now() + 45_000;
const post = (id: string) => fdb.rows("posts").find((p) => p.id === id)!;
/** 다음 실행 시점까지 시간이 흐른 것처럼 */
const fastForward = (id: string) => {
  post(id).next_attempt_at = past(1);
  post(id).locked_until = null;
};

beforeEach(() => {
  fdb = new FakeDb();
  api = new FakeThreads();
  vi.stubGlobal("fetch", api.fetch);
  for (const [id, uid, name] of [
    [ACC, "1001", "tester"],
    [ACC2, "1002", "tester2"],
  ]) {
    fdb.rows("threads_accounts").push({
      id,
      threads_user_id: uid,
      username: name,
      access_token_enc: encryptToken(`token-${uid}`),
      token_expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      token_refreshed_at: past(86400 * 2),
      status: "active",
      daily_post_limit: 10,
    });
  }
  fdb.rows("disclosures").push({
    id: DISC,
    name: "쿠팡 파트너스",
    text: DISC_TEXT,
    match_domains: ["link.coupang.com", "coupa.ng"],
    default_position: "link_reply",
  });
});
afterEach(() => vi.unstubAllGlobals());

const img = (n: number) => ({
  storagePath: `uploads/u${n}/p${n}.jpg`,
  publicUrl: `https://proj.supabase.co/storage/v1/object/public/media/uploads/u${n}/p${n}.jpg`,
  mediaType: "image" as const,
});

describe("publisher (M3 완료 기준)", () => {
  it("사진 3장 캐러셀 + 첫 댓글(링크+고지)을 예약 시간에 발행한다", async () => {
    const { postId } = await savePost(
      {
        accountId: ACC,
        text: "요즘 잘 쓰는 살림템 3가지",
        media: [img(1), img(2), img(3)],
        linkUrl: "https://link.coupang.com/a/abc",
        linkPosition: "body", // 미디어가 있으니 첫 댓글로 강제돼야 함
        disclosureId: DISC,
        disclosurePosition: "link_reply",
        topicTag: "살림템",
        isAiLabel: true,
      },
      { status: "scheduled", scheduledAt: new Date(Date.now() + 3600_000) },
    );
    expect(post(postId).link_position).toBe("first_reply");

    // 예약 시간 전에는 아무 일도 없다
    let r = await runPublishBatch(deadline());
    expect(r.claimed).toBe(0);

    // 예약 시간이 됨. 캐러셀 항목은 처음엔 처리 중
    post(postId).scheduled_at = past();
    api.initialStatuses = (p) => (p.is_carousel_item === "true" ? ["IN_PROGRESS"] : []);
    r = await runPublishBatch(deadline());
    expect(r).toMatchObject({ claimed: 1, waiting: 1, published: 0 });
    expect(post(postId).status).toBe("processing");
    expect(post(postId).locked_until).toBeNull();
    const items = api.created((p) => p.is_carousel_item === "true");
    expect(items).toHaveLength(3);
    expect(items.map((c) => c.params.image_url)).toEqual([img(1).publicUrl, img(2).publicUrl, img(3).publicUrl]);
    expect(items.every((c) => c.params.is_made_with_ai === undefined)).toBe(true); // 항목에는 AI 표시 금지(문서)
    expect(fdb.rows("post_media").every((m) => m.container_id)).toBe(true);

    // 다음 실행: 항목 FINISHED → 부모 컨테이너 → 발행 → 첫 댓글까지
    fastForward(postId);
    r = await runPublishBatch(deadline());
    expect(r).toMatchObject({ published: 1, repliesPublished: 1, failed: 0 });

    const parent = api.created((p) => p.media_type === "CAROUSEL")[0];
    expect(parent.params.children).toBe("c1,c2,c3");
    expect(parent.params.text).toBe("요즘 잘 쓰는 살림템 3가지");
    expect(parent.params.topic_tag).toBe("살림템");
    expect(parent.params.is_made_with_ai).toBe("true");
    expect(parent.params.link_attachment).toBeUndefined();

    const reply = api.created((p) => !!p.reply_to_id)[0];
    expect(reply.params.media_type).toBe("TEXT");
    expect(reply.params.text).toBe(`https://link.coupang.com/a/abc\n\n${DISC_TEXT}`);
    expect(reply.params.reply_to_id).toBe(post(postId).threads_media_id);

    const p = post(postId);
    expect(p.status).toBe("published");
    expect(p.permalink).toMatch(/^https:\/\/www\.threads\.com\//);
    expect(p.replies_pending).toBe(false);
    expect(fdb.rows("post_replies").every((x) => x.status === "published")).toBe(true);
    expect(fdb.rows("post_media").every((m) => m.delete_after)).toBe(true); // 30일 뒤 삭제 예약
    expect(fdb.rows("notifications").some((n) => n.type === "publish_success")).toBe(true);

    // 다시 돌려도 중복 발행되지 않는다
    r = await runPublishBatch(deadline());
    expect(r.claimed).toBe(0);
    expect(api.published()).toHaveLength(2); // 본문 1 + 댓글 1
  });

  it("텍스트 글은 link_attachment 를 쓰고, 여러 댓글은 스레드로 이어 단다", async () => {
    const { postId } = await savePost(
      { accountId: ACC, text: "본문", replies: ["하나", "둘"], linkUrl: "https://example.com", linkPosition: "body" },
      { status: "scheduled", scheduledAt: new Date(Date.now() - 1000) },
    );
    await runPublishBatch(deadline());
    const main = api.created((p) => p.media_type === "TEXT" && !p.reply_to_id)[0];
    expect(main.params.link_attachment).toBe("https://example.com");
    const replies = api.created((p) => !!p.reply_to_id);
    expect(replies.map((c) => c.params.text)).toEqual(["하나", "둘"]);
    expect(replies[0].params.reply_to_id).toBe(post(postId).threads_media_id);
    expect(replies[1].params.reply_to_id).not.toBe(replies[0].params.reply_to_id); // 첫 댓글에 이어서
  });

  it("같은 회차의 여러 글은 30초~2분 간격으로 나눠 발행한다", async () => {
    const a = await savePost({ accountId: ACC, text: "A" }, { status: "scheduled", scheduledAt: new Date(Date.now() - 2000) });
    const b = await savePost({ accountId: ACC2, text: "B" }, { status: "scheduled", scheduledAt: new Date(Date.now() - 1000) });
    const r = await runPublishBatch(deadline());
    expect(r.published).toBe(1);
    expect(post(a.postId).status).toBe("published");
    const wait = (Date.parse(String(post(b.postId).next_attempt_at)) - Date.now()) / 1000;
    expect(post(b.postId).status).toBe("processing");
    expect(wait).toBeGreaterThanOrEqual(28);
    expect(wait).toBeLessThanOrEqual(121);
  });

  it("실패하면 1분·5분 뒤 재시도하고 3회째 failed + 알림", async () => {
    const { postId } = await savePost({ accountId: ACC, text: "재시도" }, { status: "scheduled", scheduledAt: new Date(Date.now() - 1000) });
    api.failPublish = { status: 500, body: { error: { message: "일시 오류", code: 2 } } };
    const delays: number[] = [];
    for (let i = 0; i < 3; i++) {
      await runPublishBatch(deadline());
      if (post(postId).next_attempt_at) delays.push(Math.round((Date.parse(String(post(postId).next_attempt_at)) - Date.now()) / 60_000));
      fastForward(postId);
    }
    expect(delays).toEqual([1, 5]);
    expect(post(postId).status).toBe("failed");
    expect(post(postId).attempt_count).toBe(3);
    expect(post(postId).last_error).toContain("일시 오류");
    expect(fdb.rows("notifications").some((n) => n.type === "publish_failed")).toBe(true);
    // 컨테이너는 한 번만 만들고 재사용
    expect(api.created()).toHaveLength(1);
  });

  it("토큰 오류(190)는 바로 실패시키고 계정을 재연결 필요로 바꾼다", async () => {
    const { postId } = await savePost({ accountId: ACC, text: "토큰" }, { status: "scheduled", scheduledAt: new Date(Date.now() - 1000) });
    api.failPublish = { status: 400, body: { error: { message: "Error validating access token", type: "OAuthException", code: 190 } } };
    await runPublishBatch(deadline());
    expect(post(postId).status).toBe("failed");
    expect(fdb.rows("threads_accounts").find((a) => a.id === ACC)!.status).toBe("needs_reconnect");
  });

  it("재연결이 필요한 계정의 예약 글은 실패 처리한다", async () => {
    fdb.rows("threads_accounts").find((a) => a.id === ACC)!.status = "needs_reconnect";
    fdb.rows("posts").push({ id: "p-x", account_id: ACC, status: "scheduled", text: "x", scheduled_at: past(), attempt_count: 0 });
    await runPublishBatch(deadline());
    expect(post("p-x").status).toBe("failed");
    expect(api.calls).toHaveLength(0);
  });

  it("오류가 있는 글은 예약할 수 없고, 발행 중인 글은 수정할 수 없다", async () => {
    await expect(savePost({ accountId: ACC, text: "가".repeat(501) }, { status: "scheduled", scheduledAt: new Date() })).rejects.toThrow(/500자/);
    const { postId } = await savePost({ accountId: ACC, text: "ok" }, { status: "draft" });
    post(postId).status = "processing";
    await expect(savePost({ accountId: ACC, text: "수정" }, { postId, status: "draft" })).rejects.toThrow(/수정할 수 없습니다/);
  });
});
