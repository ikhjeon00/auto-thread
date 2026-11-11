/** 화면에 보여 줄 에러 문구(한국어). 검증 오류의 원본 데이터가 그대로 노출되지 않게 한다 */
import { z } from "zod";

const HANGUL = /[가-힣]/;

const GENERIC: Record<string, string> = {
  invalid_type: "값의 종류가 올바르지 않습니다",
  invalid_format: "형식이 올바르지 않습니다",
  too_small: "값이 너무 짧거나 작습니다",
  too_big: "값이 너무 길거나 큽니다",
  invalid_value: "허용되지 않는 값입니다",
  unrecognized_keys: "알 수 없는 항목이 있습니다",
  custom: "입력값을 확인하세요",
};

export function errorMessage(e: unknown): string {
  if (e instanceof z.ZodError) {
    const msgs = e.issues.map((i) => (HANGUL.test(i.message) ? i.message : `${GENERIC[i.code] ?? "입력값을 확인하세요"}${i.path.length ? ` (${i.path.join(".")})` : ""}`));
    return [...new Set(msgs)].join(" / ");
  }
  if (e instanceof Error) {
    if (e.message === "fetch failed" || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/.test(e.message)) return "서버에 연결하지 못했습니다. 잠시 뒤 다시 시도하세요.";
    if (e.message === "로그인이 필요합니다.") return "로그인이 만료되었습니다. 새로고침 후 다시 로그인하세요.";
    return e.message;
  }
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
