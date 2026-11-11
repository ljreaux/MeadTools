import assert from "node:assert/strict";
import test from "node:test";
import { arePremiumSubscriptionsAvailable, getPremiumStripePriceId, areAnnualPremiumSubscriptionsAvailable, premiumPlanForPriceId } from "./premium-subscription-config";

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

test("annual sales need their own switch and distinct price, while renewal verification remains available", () => {
  const env = { PREMIUM_SUBSCRIPTIONS_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    STRIPE_PREMIUM_PRICE_ID: "price_month", STRIPE_PREMIUM_ANNUAL_PRICE_ID: "price_year", PREMIUM_ANNUAL_SUBSCRIPTIONS_ENABLED: "true" };
  assert.equal(areAnnualPremiumSubscriptionsAvailable(env), true);
  assert.equal(areAnnualPremiumSubscriptionsAvailable({ ...env, PREMIUM_ANNUAL_SUBSCRIPTIONS_ENABLED: "false" }), false);
  assert.equal(areAnnualPremiumSubscriptionsAvailable({ ...env, STRIPE_PREMIUM_ANNUAL_PRICE_ID: "price_month" }), false);
  assert.deepEqual(premiumPlanForPriceId("price_year", { ...env, PREMIUM_SUBSCRIPTIONS_ENABLED: "false" }), { interval: "year", priceId: "price_year", priceCents: 5000, allowanceMonths: 12 });
  assert.equal(premiumPlanForPriceId("price_untrusted", env), null);
});
