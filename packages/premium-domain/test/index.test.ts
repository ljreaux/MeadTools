import assert from "node:assert/strict";
import test from "node:test";
import {
  kofiPaidThrough,
  resolvePremiumAccess,
  PREMIUM_MONTHLY_CHAT_CREDITS,
  PREMIUM_MONTHLY_PRICE_CENTS,
} from "../src/index";

test("premium policy fixes the planned monthly price and allowance", () => {
  assert.equal(PREMIUM_MONTHLY_PRICE_CENTS, 500);
  assert.equal(PREMIUM_MONTHLY_CHAT_CREDITS, 1_000);
});

test("a paid Ko-fi renewal expires unless another payment extends it", () => {
  const paidAt = new Date("2026-10-01T00:00:00.000Z");
  const paidThrough = kofiPaidThrough(paidAt);
  const memberships = [{ source: "kofi" as const, paidThrough, revokedAt: null }];
  assert.equal(resolvePremiumAccess(memberships, paidAt).entitled, true);
  assert.equal(resolvePremiumAccess(memberships, paidThrough).entitled, false);
});

test("revocation and all expired memberships deny access", () => {
  const now = new Date("2026-10-11T00:00:00.000Z");
  assert.equal(
    resolvePremiumAccess(
      [
        {
          source: "stripe",
          paidThrough: new Date("2026-11-01T00:00:00.000Z"),
          revokedAt: new Date("2026-10-10T00:00:00.000Z"),
        },
        {
          source: "kofi",
          paidThrough: new Date("2026-10-01T00:00:00.000Z"),
          revokedAt: null,
        },
      ],
      now,
    ).entitled,
    false,
  );
});
