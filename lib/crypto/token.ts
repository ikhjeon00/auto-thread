import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Threads 토큰 암호화 (AES-256-GCM).
 * 저장 형식: "v1.<iv b64url>.<tag b64url>.<ciphertext b64url>"
 * TOKEN_ENCRYPTION_KEY: base64로 인코딩된 32바이트 키 (openssl rand -base64 32)
 */
const VERSION = "v1";

function getKey(raw = process.env.TOKEN_ENCRYPTION_KEY): Buffer {
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY 환경변수가 없습니다.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY는 base64로 인코딩된 32바이트여야 합니다.");
  }
  return key;
}

export function encryptToken(plain: string, rawKey?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(rawKey), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptToken(enc: string, rawKey?: string): string {
  const [version, iv, tag, ct] = enc.split(".");
  if (version !== VERSION || !iv || !tag || ct === undefined) {
    throw new Error("암호화된 토큰 형식이 올바르지 않습니다.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(rawKey), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
