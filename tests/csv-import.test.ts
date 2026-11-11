import { describe, expect, it, vi } from "vitest";
import { FakeDb } from "./helpers/fake-db";

let fdb: FakeDb;
vi.mock("@/lib/db/admin", () => ({ db: () => fdb }));
vi.mock("@/lib/auth/require", () => ({ requireSession: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/server", () => ({ after: () => {} }));

const { importRowsAction } = await import("@/app/(main)/pools/actions");
const { poolItemToContent } = await import("@/lib/compose/schema");
const POOL = "11111111-2222-4333-8444-555555555555";
const img = (n: string) => ({ storagePath: `assets/x/${n}.jpg`, publicUrl: `https://e.com/${n}.jpg`, mediaType: "image" as const });

describe("CSV 가져오기(사진 포함)", () => {
  it("본문 사진·첫 댓글 사진을 글 작성 형태로 저장하고, 사진 없는 줄은 예전처럼", async () => {
    fdb = new FakeDb();
    const r = await importRowsAction(
      POOL,
      [
        { text: "사진 글", first_reply: "댓글", topic_tag: "#살림", category: "살림", media: [img("1"), img("2")], reply_media: img("r") },
        { text: "글만", first_reply: "", topic_tag: "", category: "" },
        { text: "사진 6장", media: [1, 2, 3, 4, 5, 6].map((n) => img(String(n))) },
      ],
      true,
    );
    expect(r).toEqual({ ok: true, data: { added: 2, skipped: 1 } });
    const [a, b] = fdb.rows("pool_items");
    expect(a).toMatchObject({ text: "사진 글", topic_tag: "살림", status: "available", source: "csv" });
    expect(a.media).toHaveLength(2);
    const c = poolItemToContent(a as { text: string; first_reply: string | null; topic_tag: string | null; compose: unknown });
    expect(c.media.map((m) => m.storagePath)).toEqual(["assets/x/1.jpg", "assets/x/2.jpg"]);
    expect(c.replies).toEqual([{ text: "댓글", media: img("r") }]);
    expect(c.topicTag).toBe("살림");
    expect(b.compose).toBeNull();
    expect(poolItemToContent(b as { text: string; first_reply: string | null; topic_tag: string | null; compose: unknown }).text).toBe("글만");
  });
});
