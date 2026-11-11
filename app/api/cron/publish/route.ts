import { NextResponse } from "next/server";
import { runPublishBatch } from "@/lib/publisher";

// 인증은 middleware(Bearer CRON_SECRET)에서 처리. 50초 안에 끝낸다.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run() {
  const started = Date.now();
  try {
    const result = await runPublishBatch(started + 48_000);
    return NextResponse.json({ ok: true, ms: Date.now() - started, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron/publish]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
