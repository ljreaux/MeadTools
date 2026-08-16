/**
 * Stripe can deliver a dispute before the Checkout fulfillment webhook that
 * establishes its payment-intent mapping. Keep that event until fulfillment
 * rather than treating it as unrelated.
 */
export function paymentRecoveryCheckoutDisposition(
  status: "pending" | "fulfilled" | "failed" | "expired" | "refunded" | null,
): "defer" | "process" | "ignore" {
  if (status === "pending") return "defer";
  return status === "fulfilled" || status === "refunded" ? "process" : "ignore";
}

/** A completed receipt with no recovery is safe to replay once. */
export function shouldReplayStoredDispute(
  status: "deferred" | "processed",
  recoveryExists: boolean,
): boolean {
  return status === "deferred" || !recoveryExists;
}
