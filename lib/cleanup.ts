import "server-only";
import { db } from "@/lib/db/admin";
import { env } from "@/lib/env";

/**
 * 매일 05:00 KST 정리
 *  1) 발행 30일이 지난 1회용 첨부(uploads/…) 삭제 — 아직 발행 전인 글이 같은 파일을 쓰면 남긴다
 *  2) 글에 붙지 않은 채 3일 넘게 남은 업로드(작성하다 버린 사진) 삭제
 *  3) 오래된 기록 정리: 발행 로그 90일, 읽은 알림 60일, 끝난 작업 30일, AI 사용 기록 400일
 * 자료실(assets/)·상품(products/) 파일은 건드리지 않는다.
 */
const ACTIVE = ["draft", "review", "scheduled", "processing", "failed"];
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

async function inUseByActivePosts(paths: string[]): Promise<Set<string>> {
  const used = new Set<string>();
  for (let k = 0; k < paths.length; k += 200) {
    const chunk = paths.slice(k, k + 200);
    const [m, r] = await Promise.all([
      db().from("post_media").select("storage_path, post_id").in("storage_path", chunk),
      db().from("post_replies").select("storage_path, post_id").in("storage_path", chunk),
    ]);
    const refs = [...((m.data ?? []) as { storage_path: string; post_id: string }[]), ...((r.data ?? []) as { storage_path: string; post_id: string }[])];
    const postIds = [...new Set(refs.map((x) => x.post_id))];
    if (!postIds.length) continue;
    const { data: active } = await db().from("posts").select("id").in("id", postIds).in("status", ACTIVE);
    const activeIds = new Set(((active ?? []) as { id: string }[]).map((p) => p.id));
    for (const x of refs) if (activeIds.has(x.post_id)) used.add(x.storage_path);
  }
  return used;
}

async function referencedAnywhere(paths: string[]): Promise<Set<string>> {
  const used = new Set<string>();
  for (let k = 0; k < paths.length; k += 200) {
    const chunk = paths.slice(k, k + 200);
    const [m, r] = await Promise.all([
      db().from("post_media").select("storage_path").in("storage_path", chunk),
      db().from("post_replies").select("storage_path").in("storage_path", chunk),
    ]);
    for (const x of [...((m.data ?? []) as { storage_path: string }[]), ...((r.data ?? []) as { storage_path: string }[])]) used.add(x.storage_path);
  }
  return used;
}

async function removeFiles(paths: string[]): Promise<number> {
  let removed = 0;
  for (let k = 0; k < paths.length; k += 100) {
    const { data, error } = await db().storage.from(env().STORAGE_BUCKET).remove(paths.slice(k, k + 100));
    if (error) throw new Error(`파일 삭제 실패: ${error.message}`);
    removed += data?.length ?? 0;
  }
  return removed;
}

export async function runCleanup() {
  const r = { expiredFiles: 0, expiredRows: 0, orphanFiles: 0, publishLogs: 0, notifications: 0, jobs: 0, generationLogs: 0 };

  // 1) 기한 지난 1회용 첨부
  const { data: expired } = await db().from("post_media").select("id, storage_path").lt("delete_after", new Date().toISOString()).limit(1000);
  const exp = (expired ?? []) as { id: string; storage_path: string }[];
  if (exp.length) {
    const paths = [...new Set(exp.map((e) => e.storage_path).filter((p) => p.startsWith("uploads/")))];
    const keep = await inUseByActivePosts(paths);
    r.expiredFiles = await removeFiles(paths.filter((p) => !keep.has(p)));
    const rowIds = exp.filter((e) => e.storage_path.startsWith("uploads/") && !keep.has(e.storage_path)).map((e) => e.id);
    for (let k = 0; k < rowIds.length; k += 500) {
      await db().from("post_media").delete().in("id", rowIds.slice(k, k + 500));
    }
    r.expiredRows = rowIds.length;
  }

  // 2) 어디에도 붙지 않은 오래된 업로드
  const { data: stale, error: staleErr } = await db().rpc("list_stale_uploads", { p_days: 3, p_limit: 500 });
  if (staleErr) throw new Error(`list_stale_uploads 실패: ${staleErr.message}`);
  const stalePaths = ((stale ?? []) as { name: string }[]).map((s) => s.name);
  if (stalePaths.length) {
    const used = await referencedAnywhere(stalePaths);
    r.orphanFiles = await removeFiles(stalePaths.filter((p) => !used.has(p)));
  }

  // 3) 오래된 기록
  const pl = await db().from("publish_logs").delete().lt("created_at", ago(90)).select("id");
  r.publishLogs = pl.data?.length ?? 0;
  const nt = await db().from("notifications").delete().eq("is_read", true).lt("created_at", ago(60)).select("id");
  r.notifications = nt.data?.length ?? 0;
  const jb = await db().from("jobs").delete().in("status", ["done", "failed"]).lt("updated_at", ago(30)).select("id");
  r.jobs = jb.data?.length ?? 0;
  const gl = await db().from("generation_logs").delete().lt("created_at", ago(400)).select("id");
  r.generationLogs = gl.data?.length ?? 0;
  return r;
}
