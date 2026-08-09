import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { stripeSessionMatchesCreditCheckout } from "./credit-checkout-verification";

const checkout = {
  pack_id: "starter",
  credit_amount: 5_000,
  amount_cents: 500,
  currency: "usd",
  stripe_checkout_session_id: "cs_test_123"
};

function session(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_test_123",
    currency: "usd",
    amount_subtotal: 500,
    amount_total: 540,
    metadata: { credit_pack_id: "starter", credits: "5000" },
    ...overrides
  } as Stripe.Checkout.Session;
}

test("credit fulfillment verifies the pre-tax subtotal, not the tax-inclusive total", () => {
  assert.equal(stripeSessionMatchesCreditCheckout(session(), checkout), true);
});

test("credit fulfillment rejects a session with a different pack subtotal", () => {
  assert.equal(
    stripeSessionMatchesCreditCheckout(session({ amount_subtotal: 501 }), checkout),
    false
  );
});
