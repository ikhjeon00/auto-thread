import "server-only";
import { db } from "@/lib/db/admin";
import { notify } from "@/lib/notify";

/**
 * jobs 큐 (AI 일괄 생성, 농장 배치 등 오래 걸리는 작업)
 * /api/cron/jobs 가 1분마다 처리하고, 작업을 만든 직후에도 바로 한 번 돌린다.
 */
export type JobRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  total: number;
  attempts: number;
  result: unknown;
  error: string | null;
};

export type JobContext = {
  job: JobRow;
  deadline: number;
  progress: (done: number, total?: number) => Promise<void>;
};

type Handler = (ctx: JobContext) => Promise<unknown>;
const handlers = new Map<string, Handler>();

export function registerJob(type: string, handler: Handler) {
  handlers.set(type, handler);
}

export const MAX_JOB_ATTEMPTS = 3;

export async function enqueueJob(type: string, payload: Record<string, unknown>, total = 0): Promise<string> {
  const { data, error } = await db().from("jobs").insert({ type, payload, total, status: "queued" }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function runJobs(deadline: number, limit = 2): Promise<{ claimed: number; done: number; failed: number; retried: number }> {
  await import("./handlers"); // 처리기 등록
  const r = { claimed: 0, done: 0, failed: 0, retried: 0 };
  const { data, error } = await db().rpc("claim_jobs", { p_limit: limit, p_lease_seconds: 300 });
  if (error) throw new Error(`claim_jobs 실패: ${error.message}`);
  const jobs = (data ?? []) as JobRow[];
  r.claimed = jobs.length;

  for (const job of jobs) {
    if (Date.now() > deadline - 10_000) {
      await db().from("jobs").update({ locked_until: null, status: "queued" }).eq("id", job.id);
      continue;
    }
    const handler = handlers.get(job.type);
    try {
      if (!handler) throw new Error(`알 수 없는 작업 종류: ${job.type}`);
      const result = await handler({
        job,
        deadline,
        progress: async (done, total) => {
          await db().from("jobs").update({ progress: done, ...(total !== undefined ? { total } : {}) }).eq("id", job.id);
        },
      });
      await db().from("jobs").update({ status: "done", result: result ?? null, error: null, locked_until: null }).eq("id", job.id);
      r.done++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const attempts = job.attempts + 1;
      if (attempts >= MAX_JOB_ATTEMPTS) {
        await db().from("jobs").update({ status: "failed", attempts, error: msg, locked_until: null }).eq("id", job.id);
        await notify("error", job.type.startsWith("pool") ? "ai_error" : "job_failed", `작업 실패(${job.type}): ${msg}`, "/activity");
        r.failed++;
      } else {
        await db()
          .from("jobs")
          .update({ status: "queued", attempts, error: msg, locked_until: null, run_after: new Date(Date.now() + attempts * 2 * 60_000).toISOString() })
          .eq("id", job.id);
        r.retried++;
      }
    }
  }
  return r;
}
