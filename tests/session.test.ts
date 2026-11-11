import { beforeAll, describe, expect, it } from "vitest";
import { createSessionToken, safeEqual, verifySessionToken } from "@/lib/auth/session";

beforeAll(() => {
  process.env.SESSION_SECRET = "x".repeat(40);
});

describe("session token", () => {
  it("verifies a fresh token", async () => {
    expect(await verifySessionToken(await createSessionToken())).toBe(true);
  });
  it("rejects expired and forged tokens", async () => {
    const old = await createSessionToken(Date.now() - 31 * 86400_000);
    expect(await verifySessionToken(old)).toBe(false);
    const t = await createSessionToken();
    expect(await verifySessionToken(t.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBe(false);
    expect(await verifySessionToken(undefined)).toBe(false);
  });
  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

import { normalizeSupabaseUrl } from "@/lib/db/admin";
describe("normalizeSupabaseUrl", () => {
  it("strips paths and trailing slashes", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co");
    expect(normalizeSupabaseUrl(" https://abc.supabase.co/ ")).toBe("https://abc.supabase.co");
    expect(normalizeSupabaseUrl("https://abc.supabase.co")).toBe("https://abc.supabase.co");
  });
});
