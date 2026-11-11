import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/require";
import { buildAuthorizeUrl } from "@/lib/threads/client";

const STATE_COOKIE = "at_oauth_state";

/** Threads 인증 창으로 보낸다. state는 CSRF 방지용으로 쿠키에 저장 */
export async function GET(req: NextRequest) {
  await requireSession();
  const state = randomBytes(24).toString("base64url");
  let url: string;
  try {
    url = buildAuthorizeUrl(state);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "설정 오류";
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(msg)}`, req.url));
  }
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/threads/oauth",
    maxAge: 600,
  });
  return res;
}
