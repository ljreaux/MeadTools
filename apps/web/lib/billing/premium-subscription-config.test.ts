import assert from "node:assert/strict";
import test from "node:test";
import { arePremiumSubscriptionsAvailable, getPremiumStripePriceId } from "./premium-subscription-config";

test("premium sales require an explicit switch and complete Stripe configuration", () => {
  const configured = {
    PREMIUM_SUBSCRIPTIONS_ENABLED: "true",
    STRIPE_SECRET_KEY: "sk_test_fixture",
    STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    STRIPE_PREMIUM_PRICE_ID: "price_fixture",
  };
  assert.equal(arePremiumSubscriptionsAvailable(configured), true);
  assert.equal(arePremiumSubscriptionsAvailable({ ...configured, PREMIUM_SUBSCRIPTIONS_ENABLED: "false" }), false);
  assert.equal(arePremiumSubscriptionsAvailable({ ...configured, STRIPE_PREMIUM_PRICE_ID: "" }), false);
  assert.equal(getPremiumStripePriceId({ ...configured, PREMIUM_SUBSCRIPTIONS_ENABLED: "false" }), "price_fixture");
});
