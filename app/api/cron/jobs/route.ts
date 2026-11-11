import { NextResponse } from "next/server";
import { runJobs } from "@/lib/jobs";

// 인증은 middleware(Bearer CRON_SECRET). AI 일괄 생성은 오래 걸릴 수 있다
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run() {
  const started = Date.now();
  try {
    const r = await runJobs(started + 280_000);
    return NextResponse.json({ ok: true, ms: Date.now() - started, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron/jobs]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
