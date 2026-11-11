import { describe, expect, it } from "vitest";
import { addMonths, dayKeyOf, kstRange, monthGrid, weekDays } from "@/lib/calendar";

describe("calendar (KST)", () => {
  it("month grid starts on Sunday and covers the month", () => {
    const g = monthGrid("2026-11-15"); // 2026-11-01 은 일요일
    expect(g[0]).toBe("2026-11-01");
    expect(g).toHaveLength(42);
    expect(g).toContain("2026-11-30");
    expect(monthGrid("2026-12-10")[0]).toBe("2026-11-29"); // 12/1 화요일
  });
  it("week and month arithmetic", () => {
    expect(weekDays("2026-11-12")).toEqual(["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]);
    expect(addMonths("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
  });
  it("KST day boundaries", () => {
    expect(dayKeyOf("2026-11-11T15:30:00Z")).toBe("2026-11-12"); // 00:30 KST
    expect(kstRange("2026-11-12", "2026-11-12")).toEqual({ start: "2026-11-11T15:00:00.000Z", end: "2026-11-12T15:00:00.000Z" });
  });
});
