import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorMessage } from "@/lib/errors";

describe("errorMessage", () => {
  it("검증 오류를 한국어 한 줄로", () => {
    const r = z.object({ id: z.string().uuid(), name: z.string().min(1, "이름을 입력하세요.") }).safeParse({ id: "x", name: "" });
    expect(errorMessage(r.error)).toBe("형식이 올바르지 않습니다 (id) / 이름을 입력하세요.");
  });
  it("네트워크·일반 오류", () => {
    expect(errorMessage(new TypeError("fetch failed"))).toContain("서버에 연결하지 못했습니다");
    expect(errorMessage(new Error("그대로"))).toBe("그대로");
    expect(errorMessage({ message: "postgrest" })).toBe("postgrest");
  });
});
