import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("Product-update unsubscribe signing is unavailable.");
  return value;
}

function signature(userId: number) {
  return createHmac("sha256", secret())
    .update(`meadtools-product-updates:${userId}`)
    .digest("hex");
}

export function productUpdateUnsubscribeToken(userId: number) {
  return `${userId}.${signature(userId)}`;
}

export function userIdFromProductUpdateToken(token: string): number | null {
  const match = /^([1-9]\d*)\.([a-f0-9]{64})$/.exec(token);
  if (!match) return null;
  const userId = Number(match[1]);
  if (!Number.isSafeInteger(userId)) return null;
  const expected = Buffer.from(signature(userId), "hex");
  const given = Buffer.from(match[2], "hex");
  return timingSafeEqual(expected, given) ? userId : null;
}
