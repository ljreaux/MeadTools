import { createHmac, timingSafeEqual } from "node:crypto";

/** Require the exact wire representation which is hashed for one-time consent use. */
export function verifiedConsentPayload(value: string, secret: string): string | null {
  if (value.length > 4_096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)) return null;
  const [payload, signature] = value.split(".");
  if (Buffer.from(payload, "base64url").toString("base64url") !== payload) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? payload : null;
}
