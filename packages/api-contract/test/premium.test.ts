import assert from "node:assert/strict";
import test from "node:test";
import {
  kofiLinkClaimRequestBodySchema,
  kofiLinkRequestBodySchema,
  premiumAccessResponseSchema,
  premiumCheckoutRequestBodySchema,
  premiumPlanChangeRequestBodySchema,
} from "../src/zod/premium";

test("premium status exposes planned bundle without implying sales are open", () => {
  assert.equal(premiumAccessResponseSchema.parse({
    entitled: true,
    premiumEnabled: true,
    source: "kofi",
    paidThrough: "2026-11-01T00:00:00.000Z",
    paymentRestricted: false,
    kofiLinked: true,
    stripeLinked: false,
    monthlyPriceCents: 500,
    monthlyChatCredits: 1000,
    annualPriceCents: 5000, annualSubscriptionsEnabled: false, billingInterval: null, scheduledBillingInterval: null,
    subscriptionsEnabled: false,
    kofiJoinUrl: null,
    mcpEnabled: false,
  }).subscriptionsEnabled, false);
  assert.equal(premiumAccessResponseSchema.safeParse({
    entitled: false,
    premiumEnabled: false,
    source: null,
    paidThrough: null,
    paymentRestricted: false,
    kofiLinked: false,
    stripeLinked: false,
    monthlyPriceCents: 600,
    monthlyChatCredits: 1000,
    annualPriceCents: 5000, annualSubscriptionsEnabled: false, billingInterval: null, scheduledBillingInterval: null,
    subscriptionsEnabled: false,
    kofiJoinUrl: null,
    mcpEnabled: false,
  }).success, false);
});

test("Ko-fi link requests accept one address or one bounded claim token", () => {
  assert.equal(kofiLinkRequestBodySchema.safeParse({ email: "payer@example.com" }).success, true);
  assert.equal(kofiLinkRequestBodySchema.safeParse({ email: "payer@example.com", userId: 42 }).success, false);
  assert.equal(kofiLinkClaimRequestBodySchema.safeParse({ token: "x".repeat(43) }).success, true);
  assert.equal(kofiLinkClaimRequestBodySchema.safeParse({ token: "short" }).success, false);
});

 test("premium checkout defaults old callers to monthly and rejects arbitrary prices", () => {
  assert.deepEqual(premiumCheckoutRequestBodySchema.parse({}), { interval: "month" });
  assert.deepEqual(premiumCheckoutRequestBodySchema.parse({ interval: "year" }), { interval: "year" });
  for (const body of [{ interval: "week" }, { interval: "year", price: "price_attacker" }, { userId: 42 }]) {
    assert.equal(premiumCheckoutRequestBodySchema.safeParse(body).success, false);
  }
  assert.equal(premiumPlanChangeRequestBodySchema.safeParse({}).success, false);
  assert.equal(premiumPlanChangeRequestBodySchema.safeParse({ interval: "month" }).success, true);
});
