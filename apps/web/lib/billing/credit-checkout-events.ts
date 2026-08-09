/** Stripe events that can carry a successfully paid one-time Checkout Session. */
export function isPaidCreditCheckoutEvent(eventType: string): boolean {
  return eventType === "checkout.session.completed" ||
    eventType === "checkout.session.async_payment_succeeded";
}

export function isStripeRefundEvent(eventType: string): boolean {
  return eventType === "refund.created" || eventType === "refund.updated";
}

export function isStripeDisputeRecoveryEvent(eventType: string): boolean {
  // `created` is the first reliable point at which the customer has opened a
  // dispute. Waiting for `funds_withdrawn` leaves the account usable during
  // the review window, and some sandbox disputes do not emit it immediately.
  // Keep the later event too: recovery creation is idempotent by dispute ID.
  return eventType === "charge.dispute.created" ||
    eventType === "charge.dispute.funds_withdrawn";
}
