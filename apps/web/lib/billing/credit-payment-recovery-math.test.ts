import assert from "node:assert/strict";
import test from "node:test";
import { calculateCreditRefundReconciliation } from "./credit-payment-recovery-math";

test("a full refund revokes the full fixed credit pack", () => {
  assert.deepEqual(
    calculateCreditRefundReconciliation({
      creditAmount: 5_000,
      paymentAmountCents: 540,
      priorRefundedAmountCents: 0,
      priorRevokedCredits: 0,
      refundAmountCents: 540,
    }),
    { refundedAmountCents: 540, creditsToRevoke: 5_000 },
  );
});

test("partial refunds revoke only the additional proportional credits", () => {
  assert.deepEqual(
    calculateCreditRefundReconciliation({
      creditAmount: 5_000,
      paymentAmountCents: 540,
      priorRefundedAmountCents: 0,
      priorRevokedCredits: 0,
      refundAmountCents: 270,
    }),
    { refundedAmountCents: 270, creditsToRevoke: 2_500 },
  );
  assert.deepEqual(
    calculateCreditRefundReconciliation({
      creditAmount: 5_000,
      paymentAmountCents: 540,
      priorRefundedAmountCents: 270,
      priorRevokedCredits: 2_500,
      refundAmountCents: 270,
    }),
    { refundedAmountCents: 540, creditsToRevoke: 2_500 },
  );
});

test("refund reconciliation rejects an amount beyond the verified payment", () => {
  assert.throws(
    () =>
      calculateCreditRefundReconciliation({
        creditAmount: 5_000,
        paymentAmountCents: 500,
        priorRefundedAmountCents: 400,
        priorRevokedCredits: 4_000,
        refundAmountCents: 101,
      }),
    /exceeds the verified payment total/,
  );
});
