import assert from "node:assert/strict";
import test from "node:test";
import {
  isPaidCreditCheckoutEvent,
  isStripeDisputeRecoveryEvent,
  isStripeRefundEvent,
  isTerminalCreditCheckoutEvent,
} from "./credit-checkout-events";

test("only completed or asynchronously successful Checkout events can fulfill credits", () => {
  assert.equal(isPaidCreditCheckoutEvent("checkout.session.completed"), true);
  assert.equal(
    isPaidCreditCheckoutEvent("checkout.session.async_payment_succeeded"),
    true,
  );
  assert.equal(
    isPaidCreditCheckoutEvent("checkout.session.async_payment_failed"),
    false,
  );
  assert.equal(isPaidCreditCheckoutEvent("payment_intent.succeeded"), false);
});

test("failed and expired Checkout events are terminal without granting credits", () => {
  assert.equal(
    isTerminalCreditCheckoutEvent("checkout.session.async_payment_failed"),
    true,
  );
  assert.equal(isTerminalCreditCheckoutEvent("checkout.session.expired"), true);
  assert.equal(
    isTerminalCreditCheckoutEvent("checkout.session.completed"),
    false,
  );
});

test("refund and dispute events use dedicated recovery paths", () => {
  assert.equal(isStripeRefundEvent("refund.created"), true);
  assert.equal(isStripeRefundEvent("refund.updated"), true);
  assert.equal(isStripeRefundEvent("refund.failed"), false);
  assert.equal(isStripeDisputeRecoveryEvent("charge.dispute.created"), true);
  assert.equal(
    isStripeDisputeRecoveryEvent("charge.dispute.funds_withdrawn"),
    true,
  );
  assert.equal(isStripeDisputeRecoveryEvent("charge.dispute.closed"), false);
});
