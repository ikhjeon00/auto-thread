import { describe, expect, it, vi } from "vitest";
import { FakeDb } from "./helpers/fake-db";

let fdb: FakeDb;
vi.mock("@/lib/db/admin", () => ({ db: () => fdb }));
process.env.STORAGE_BUCKET = "media";
vi.mock("@/lib/env", () => ({ env: () => ({ STORAGE_BUCKET: "media" }) }));

const { runCleanup } = await import("@/lib/cleanup");
const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

describe("정리 작업", () => {
  it("기한 지난 1회용 첨부만 지우고, 예약 글이 쓰는 파일·자료실 파일·쓰이는 업로드는 남긴다", async () => {
    fdb = new FakeDb();
    fdb.rows("posts").push({ id: "old", status: "published" }, { id: "future", status: "scheduled" });
    fdb.rows("post_media").push(
      { id: "m1", post_id: "old", storage_path: "uploads/a/1.jpg", delete_after: ago(1) },
      { id: "m2", post_id: "old", storage_path: "uploads/a/shared.jpg", delete_after: ago(1) },
      { id: "m3", post_id: "future", storage_path: "uploads/a/shared.jpg", delete_after: null },
      { id: "m4", post_id: "old", storage_path: "assets/b/kept.jpg", delete_after: ago(1) },
      { id: "m5", post_id: "old", storage_path: "uploads/a/notyet.jpg", delete_after: ago(-5) },
    );
    fdb.rows("storage_objects").push(
      { name: "uploads/x/abandoned.jpg", created_at: ago(5) },
      { name: "uploads/x/fresh.jpg", created_at: ago(1) },
      { name: "uploads/a/notyet.jpg", created_at: ago(10) },
    );
    fdb.rows("publish_logs").push({ id: "l1", created_at: ago(100) }, { id: "l2", created_at: ago(5) });
    fdb.rows("notifications").push({ id: "n1", is_read: true, created_at: ago(70) }, { id: "n2", is_read: false, created_at: ago(70) });
    fdb.rows("jobs").push({ id: "j1", status: "done", updated_at: ago(40) }, { id: "j2", status: "queued", updated_at: ago(40) });

    const r = await runCleanup();
    expect(fdb.removed.sort()).toEqual(["uploads/a/1.jpg", "uploads/x/abandoned.jpg"]);
    expect(fdb.rows("post_media").map((m) => m.id).sort()).toEqual(["m2", "m3", "m4", "m5"]);
    expect(r).toMatchObject({ expiredFiles: 1, orphanFiles: 1, publishLogs: 1, notifications: 1, jobs: 1 });
    expect(fdb.rows("notifications").map((n) => n.id)).toEqual(["n2"]);
  });
});
