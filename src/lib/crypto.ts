import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (n = 32) => randomBytes(n).toString("base64url");
export const hmacHex = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("hex");
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
