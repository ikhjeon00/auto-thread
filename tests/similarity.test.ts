import { describe, expect, it } from "vitest";
import { mostSimilar, similarity } from "@/lib/text/similarity";

describe("similarity", () => {
  it("identical text is 1, unrelated is low", () => {
    expect(similarity("오늘 점심 뭐 먹지", "오늘 점심 뭐 먹지!")).toBe(1);
    expect(similarity("오늘 점심 뭐 먹지", "주말에 등산 다녀왔어요")).toBeLessThan(0.2);
  });
  it("finds the most similar", () => {
    expect(mostSimilar("퇴근하고 운동 가기 싫다", ["주말 계획", "퇴근하고 운동 가기 너무 싫다"])?.text).toBe("퇴근하고 운동 가기 너무 싫다");
  });
});
