export type CreditRefundReconciliation = {
  refundedAmountCents: number;
  creditsToRevoke: number;
};

/**
 * Maps cumulative financial refunds to the fixed credit pack they reversed.
 * The provider amount includes any tax or presentment conversion, so the
 * credit calculation is proportional to the verified original payment total.
 */
export function calculateCreditRefundReconciliation(options: {
  creditAmount: number;
  paymentAmountCents: number;
  priorRefundedAmountCents: number;
  priorRevokedCredits: number;
  refundAmountCents: number;
}): CreditRefundReconciliation {
  const values = Object.values(options);
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new RangeError(
      "refund reconciliation inputs must be non-negative safe integers.",
    );
  }
  if (options.creditAmount < 1 || options.paymentAmountCents < 1) {
    throw new RangeError(
      "a credit pack and payment amount are required for refund reconciliation.",
    );
  }

  const refundedAmountCents =
    options.priorRefundedAmountCents + options.refundAmountCents;
  if (refundedAmountCents > options.paymentAmountCents) {
    throw new RangeError("refund amount exceeds the verified payment total.");
  }
  const targetRevokedCredits = Math.min(
    options.creditAmount,
    Math.ceil(
      (options.creditAmount * refundedAmountCents) / options.paymentAmountCents,
    ),
  );
  if (targetRevokedCredits < options.priorRevokedCredits) {
    throw new RangeError("refund reconciliation cannot restore credits.");
  }

  return {
    refundedAmountCents,
    creditsToRevoke: targetRevokedCredits - options.priorRevokedCredits,
  };
}
