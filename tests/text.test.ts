import { describe, expect, it } from "vitest";
import { countThreadsChars } from "@/lib/threads/text";

describe("countThreadsChars", () => {
  it("counts letters as 1", () => {
    expect(countThreadsChars("안녕하세요")).toBe(5);
    expect(countThreadsChars("hello world")).toBe(11);
  });
  it("counts emoji as UTF-8 bytes", () => {
    expect(countThreadsChars("😀")).toBe(4);
    expect(countThreadsChars("가😀")).toBe(5);
    expect(countThreadsChars("❤️")).toBe(6); // U+2764 U+FE0F
    expect(countThreadsChars("👍🏻")).toBe(8); // 피부색 수정자 포함
    expect(countThreadsChars("🇰🇷")).toBe(8);
  });
  it("counts newlines", () => {
    expect(countThreadsChars("a\nb")).toBe(3);
  });
});
