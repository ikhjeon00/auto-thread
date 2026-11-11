import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/** 서버 액션·라우트에서 로그인 여부를 한 번 더 확인한다(middleware와 이중 방어). */
export async function requireSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) throw new Error("로그인이 필요합니다.");
}
