import { describe, expect, it } from "vitest";
import { normalizeFileName, planRowImages } from "@/lib/csv-images";

describe("CSV 사진 짝짓기", () => {
  it("이름(대소문자·경로 무시)으로 짝짓고, 없는 파일·5장 초과·댓글 2장을 오류로 표시", () => {
    const rows: Record<string, string>[] = [
      { text: "a", images: "A.JPG | b.png", reply_image: "C:\\\\사진\\\\r.jpg" },
      { text: "b", images: "", reply_image: "" },
      { text: "c", images: "a.jpg|missing.jpg" },
      { text: "d", images: "1|2|3|4|5|6" },
      { text: "e", reply_image: "a.jpg|b.png" },
    ];
    const plan = planRowImages(rows, ["a.jpg", "B.PNG", "r.jpg", "1", "2", "3", "4", "5", "6"]);
    expect(plan.rows.map((r) => r.error)).toEqual([null, null, "없는 파일: missing.jpg", "본문 사진이 6장입니다(최대 5장).", "첫 댓글 사진은 1장만 넣을 수 있습니다."]);
    expect(plan.rows[0]).toMatchObject({ images: ["A.JPG", "b.png"], replyImage: "C:\\\\사진\\\\r.jpg" });
    expect(plan.missing).toEqual(["missing.jpg"]);
    expect(plan.needed.sort()).toEqual(["1", "2", "3", "4", "5", "6", "a.jpg", "b.png", "r.jpg"].sort());
    expect(normalizeFileName("폴더/사진.JPG")).toBe("사진.jpg");
  });
});
