import assert from "node:assert/strict";
import test from "node:test";
import { areCreditPurchasesAvailable } from "./credit-purchase-config";

test("credit purchases fail closed until the operator enables them and webhook fulfillment is configured", () => {
  assert.equal(areCreditPurchasesAvailable({
    STRIPE_SECRET_KEY: "test-key",
    STRIPE_WEBHOOK_SECRET: "test-webhook"
  }), false);
  assert.equal(areCreditPurchasesAvailable({
    CHAT_CREDIT_PURCHASES_ENABLED: "true",
    STRIPE_SECRET_KEY: "test-key"
  }), false);
  assert.equal(areCreditPurchasesAvailable({
    CHAT_CREDIT_PURCHASES_ENABLED: "true",
    STRIPE_WEBHOOK_SECRET: "test-webhook"
  }), false);
  assert.equal(areCreditPurchasesAvailable({
    CHAT_CREDIT_PURCHASES_ENABLED: "true",
    STRIPE_SECRET_KEY: "test-key",
    STRIPE_WEBHOOK_SECRET: "test-webhook"
  }), true);
});
