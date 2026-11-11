import { NextResponse } from "next/server";
import { runCleanup } from "@/lib/cleanup";

// 인증은 middleware(Bearer CRON_SECRET)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run() {
  try {
    return NextResponse.json({ ok: true, ...(await runCleanup()) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron/cleanup]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
