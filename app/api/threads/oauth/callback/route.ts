import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/require";
import { safeEqual } from "@/lib/auth/session";
import { exchangeCode, exchangeLongLived } from "@/lib/threads/client";
import { upsertAccountFromToken } from "@/lib/threads/accounts";
import { notify } from "@/lib/notify";

const STATE_COOKIE = "at_oauth_state";

export async function GET(req: NextRequest) {
  await requireSession();
  const sp = req.nextUrl.searchParams;
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/settings?${q}`, req.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/threads/oauth" });
    return res;
  };

  if (sp.get("error")) {
    return back(`error=${encodeURIComponent(sp.get("error_description")?.replace(/\+/g, " ") ?? "연결이 취소되었습니다.")}`);
  }

  const state = sp.get("state") ?? "";
  const expected = req.cookies.get(STATE_COOKIE)?.value ?? "";
  if (!state || !expected || !safeEqual(state, expected)) {
    return back(`error=${encodeURIComponent("보안 확인(state)이 맞지 않습니다. 다시 시도하세요.")}`);
  }

  // 문서: 리다이렉트 끝에 붙는 "#_"는 코드가 아니다(프래그먼트라 서버로 오지 않지만 방어적으로 제거)
  const code = (sp.get("code") ?? "").replace(/#_$/, "");
  if (!code) return back(`error=${encodeURIComponent("인증 코드가 없습니다.")}`);

  try {
    const short = await exchangeCode(code);
    const long = await exchangeLongLived(short.access_token);
    const acc = await upsertAccountFromToken(long);
    await notify("info", "account_connected", `@${acc.username} 계정을 ${acc.isNew ? "연결" : "다시 연결"}했습니다.`, "/settings");
    return back(`connected=${encodeURIComponent(acc.username)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[oauth/callback]", msg);
    return back(`error=${encodeURIComponent(`연결 실패: ${msg}`)}`);
  }
}
