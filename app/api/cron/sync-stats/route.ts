import { NextResponse } from "next/server";
import { syncAccounts, syncPosts } from "@/lib/stats/sync";

// 인증은 middleware(Bearer CRON_SECRET). 50초 안에 끝낸다
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run() {
  const started = Date.now();
  try {
    const accounts = await syncAccounts(started + 25_000);
    const posts = await syncPosts(started + 48_000);
    return NextResponse.json({ ok: true, ms: Date.now() - started, accounts, posts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron/sync-stats]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
