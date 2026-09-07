import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | undefined;

/** Returns no client until a server-only Stripe key is configured. */
export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;

  stripeClient ??= new Stripe(secretKey, {
    apiVersion: "2026-07-29.dahlia",
    typescript: true,
  });
  return stripeClient;
}

/** The webhook secret is intentionally never read by browser code. */
export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

/** A server-derived Dashboard URL avoids exposing or duplicating Stripe mode in the client. */
export function stripeDashboardDisputeUrl(disputeId: string): string {
  const testMode =
    process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ?? false;
  const path = `disputes/${encodeURIComponent(disputeId)}`;
  return `https://dashboard.stripe.com/${testMode ? "test/" : ""}${path}`;
}
