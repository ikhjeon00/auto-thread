import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("quotes, commas, newlines, escaped quotes, BOM, CRLF", () => {
    const csv = '﻿text,first_reply,topic_tag,category\r\n"첫 줄\n둘째 줄, 쉼표",댓글,일상,생활\r\n"그는 ""안녕"" 했다",,,\r\n\r\n';
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["text", "first_reply", "topic_tag", "category"]);
    expect(rows).toEqual([
      { text: "첫 줄\n둘째 줄, 쉼표", first_reply: "댓글", topic_tag: "일상", category: "생활" },
      { text: '그는 "안녕" 했다', first_reply: "", topic_tag: "", category: "" },
    ]);
  });
  it("missing columns become empty", () => {
    expect(parseCsv("text\n하나").rows).toEqual([{ text: "하나" }]);
  });
});
