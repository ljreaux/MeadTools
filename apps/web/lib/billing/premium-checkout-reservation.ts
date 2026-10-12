import type Stripe from "stripe";

export class PremiumCheckoutStateError extends Error {
  constructor(public kind: "conflict" | "unavailable", message: string) { super(message); }
}

export type CheckoutAttempt = {
  attempt_id: string;
  params: Stripe.Checkout.SessionCreateParams;
  session_id: string | null;
  created_at: Date;
};

/** Store operations must be atomic. Reserve returns the winner; replace is compare-and-swap. */
export async function resumePremiumCheckout(deps: {
  reserve: () => Promise<CheckoutAttempt>;
  replace: (attemptId: string) => Promise<void>;
  save: (attemptId: string, sessionId: string) => Promise<void>;
  create: (params: Stripe.Checkout.SessionCreateParams, key: string) => Promise<Stripe.Checkout.Session>;
  retrieve: (id: string) => Promise<Stripe.Checkout.Session>;
  completedSubscriptionCanBeReplaced: (id: string) => Promise<boolean>;
  now?: () => number;
}): Promise<{ url: string }> {
  for (let retry = 0; retry < 4; retry++) {
    const attempt = await deps.reserve();
    // Stripe only guarantees retention of idempotency keys for 24 hours. An
    // unresolved older request needs reconciliation, never a blind retry.
    if (!attempt.session_id && (deps.now?.() ?? Date.now()) - attempt.created_at.getTime() >= 23 * 60 * 60_000) {
      throw new PremiumCheckoutStateError("unavailable", "Checkout needs billing support to reconcile a previous attempt. Please do not retry payment.");
    }
    let session: Stripe.Checkout.Session;
    try {
      session = attempt.session_id
      ? await deps.retrieve(attempt.session_id)
      : await deps.create(attempt.params, `premium-checkout:${attempt.attempt_id}`);
    } catch (error) {
      if (typeof error === "object" && error !== null && "param" in error && error.param === "expires_at") {
        throw new PremiumCheckoutStateError("unavailable", "Checkout needs billing support to reconcile an expired request.");
      }
      throw error;
    }
    if (!attempt.session_id) await deps.save(attempt.attempt_id, session.id);
    if (session.status === "open" && session.url) return { url: session.url };
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (session.status === "expired" || (session.status === "complete" && subscriptionId &&
      await deps.completedSubscriptionCanBeReplaced(subscriptionId))) {
      await deps.replace(attempt.attempt_id);
      continue;
    }
    throw new PremiumCheckoutStateError("conflict", "Checkout is already complete or unavailable. Please refresh your account to check your subscription.");
  }
  throw new PremiumCheckoutStateError("conflict", "Checkout changed concurrently. Please retry.");
}
