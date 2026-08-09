import assert from "node:assert/strict";
import test from "node:test";
import {
  paymentRecoveryCheckoutDisposition,
  shouldReplayStoredDispute
} from "./credit-payment-recovery-ordering";

test("an early Stripe dispute is deferred until its Checkout payment is fulfilled", () => {
  assert.equal(paymentRecoveryCheckoutDisposition("pending"), "defer");
  assert.equal(paymentRecoveryCheckoutDisposition("fulfilled"), "process");
  assert.equal(paymentRecoveryCheckoutDisposition("refunded"), "process");
  assert.equal(paymentRecoveryCheckoutDisposition("failed"), "ignore");
  assert.equal(paymentRecoveryCheckoutDisposition(null), "ignore");
});

test("a processed receipt without a recovery is replayed once for repair", () => {
  assert.equal(shouldReplayStoredDispute("deferred", false), true);
  assert.equal(shouldReplayStoredDispute("processed", false), true);
  assert.equal(shouldReplayStoredDispute("processed", true), false);
});
