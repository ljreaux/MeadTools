import assert from "node:assert/strict";
import test from "node:test";
import {
  areCreditPurchasesAvailable,
  canUserPurchaseCredits,
  getCreditPackPriceId,
} from "./credit-purchase-config";

test("credit purchases fail closed until the operator enables them and webhook fulfillment is configured", () => {
  assert.equal(
    areCreditPurchasesAvailable({
      STRIPE_SECRET_KEY: "test-key",
      STRIPE_WEBHOOK_SECRET: "test-webhook",
    }),
    false,
  );
  assert.equal(
    areCreditPurchasesAvailable({
      CHAT_CREDIT_PURCHASES_ENABLED: "true",
      STRIPE_SECRET_KEY: "test-key",
    }),
    false,
  );
  assert.equal(
    areCreditPurchasesAvailable({
      CHAT_CREDIT_PURCHASES_ENABLED: "true",
      STRIPE_WEBHOOK_SECRET: "test-webhook",
    }),
    false,
  );
  assert.equal(
    areCreditPurchasesAvailable({
      CHAT_CREDIT_PURCHASES_ENABLED: "true",
      STRIPE_SECRET_KEY: "test-key",
      STRIPE_WEBHOOK_SECRET: "test-webhook",
    }),
    true,
  );
});

test("production purchases require a catalog price for every fixed pack", () => {
  const production = {
    VERCEL_ENV: "production",
    CHAT_CREDIT_PURCHASES_ENABLED: "true",
    STRIPE_SECRET_KEY: "test-key",
    STRIPE_WEBHOOK_SECRET: "test-webhook",
    STRIPE_CREDIT_PRICE_STARTER: "price_starter",
    STRIPE_CREDIT_PRICE_STANDARD: "price_standard",
  };
  assert.equal(areCreditPurchasesAvailable(production), false);
  assert.equal(getCreditPackPriceId("reserve", production), null);
  assert.equal(
    areCreditPurchasesAvailable({
      ...production,
      STRIPE_CREDIT_PRICE_RESERVE: "price_reserve",
    }),
    true,
  );
  assert.equal(
    getCreditPackPriceId("standard", production),
    "price_standard",
  );
});

test("purchases stay hidden for accounts without hosted-chat access", () => {
  const configured = {
    CHAT_CREDIT_PURCHASES_ENABLED: "true",
    STRIPE_SECRET_KEY: "test-key",
    STRIPE_WEBHOOK_SECRET: "test-webhook",
  };
  assert.equal(canUserPurchaseCredits(false, true, configured), false);
  assert.equal(canUserPurchaseCredits(true, false, configured), false);
  assert.equal(canUserPurchaseCredits(true, true, configured), true);
});
