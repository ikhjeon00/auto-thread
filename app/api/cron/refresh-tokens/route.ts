import { NextResponse } from "next/server";
import { db } from "@/lib/db/admin";
import { refreshAccountToken, type AccountRow, type RefreshResult } from "@/lib/threads/accounts";

// 인증은 middleware(Bearer CRON_SECRET)에서 처리
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run() {
  const started = Date.now();
  const soon = new Date(started + 7 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await db()
    .from("threads_accounts")
    .select("id, threads_user_id, username, access_token_enc, token_expires_at, token_refreshed_at, status")
    .eq("status", "active")
    .or(`token_expires_at.is.null,token_expires_at.lte.${soon}`)
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<RefreshResult, number> = { refreshed: 0, skipped: 0, expired: 0, failed: 0 };
  const queue = [...(data as AccountRow[])];
  // 동시 5개, 45초 안에서 처리
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (queue.length && Date.now() - started < 45_000) {
        const acc = queue.shift()!;
        counts[await refreshAccountToken(acc)]++;
      }
    }),
  );
  return NextResponse.json({ ok: true, checked: data.length, ...counts, remaining: queue.length });
}

export const GET = run;
export const POST = run;
