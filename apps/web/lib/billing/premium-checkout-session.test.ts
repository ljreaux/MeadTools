import assert from "node:assert/strict";
import test from "node:test";
import { buildPremiumCheckoutSessionParams } from "./premium-checkout-session";

test("premium Checkout uses the fixed monthly price and Managed Payments", () => {
  const params = buildPremiumCheckoutSessionParams({
    userId: 42,
    priceId: "price_test_premium",
    email: "fixture@example.invalid",
    successUrl: "http://localhost:3000/account/premium?checkout=success",
    cancelUrl: "http://localhost:3000/account/premium?checkout=cancelled",
  });
  assert.equal(params.mode, "subscription");
  assert.deepEqual(params.managed_payments, { enabled: true });
  assert.deepEqual(params.line_items, [{ price: "price_test_premium", quantity: 1 }]);
  assert.deepEqual(params.subscription_data?.metadata, { meadtools_user_id: "42" });
  assert.equal(params.customer_email, "fixture@example.invalid");
  assert.match(params.integration_identifier ?? "", /^meadtools-premium-[a-z]{8}$/);
  assert.equal("payment_method_types" in params, false);
});

test("returning premium customer is reused without a second customer email", () => {
  const params = buildPremiumCheckoutSessionParams({
    userId: 42,
    priceId: "price_test_premium",
    customerId: "cus_fixture",
    email: "fixture@example.invalid",
    successUrl: "http://localhost:3000/account/premium",
    cancelUrl: "http://localhost:3000/account/premium",
  });
  assert.equal(params.customer, "cus_fixture");
  assert.equal(params.customer_email, undefined);
});
