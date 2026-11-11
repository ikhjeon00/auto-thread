import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/crypto/token";

const key = randomBytes(32).toString("base64");

describe("token encryption", () => {
  it("round-trips", () => {
    const enc = encryptToken("THQVJ-sample-token", key);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain("THQVJ");
    expect(decryptToken(enc, key)).toBe("THQVJ-sample-token");
  });
  it("uses a fresh IV each time", () => {
    expect(encryptToken("x", key)).not.toBe(encryptToken("x", key));
  });
  it("rejects tampering and wrong keys", () => {
    const enc = encryptToken("secret", key);
    const parts = enc.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptToken(parts.join("."), key)).toThrow();
    expect(() => decryptToken(enc, randomBytes(32).toString("base64"))).toThrow();
  });
  it("rejects keys that are not 32 bytes", () => {
    expect(() => encryptToken("x", randomBytes(16).toString("base64"))).toThrow(/32바이트/);
  });
});
