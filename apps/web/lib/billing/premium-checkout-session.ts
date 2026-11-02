import { randomBytes } from "node:crypto";
import type Stripe from "stripe";

function integrationIdentifier(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const suffix = [...randomBytes(8)].map((byte) => letters[byte % letters.length]).join("");
  return `meadtools-premium-${suffix}`;
}

export function buildPremiumCheckoutSessionParams(options: {
  userId: number;
  priceId: string;
  customerId?: string;
  email?: string;
  successUrl: string;
  cancelUrl: string;
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    managed_payments: { enabled: true },
    integration_identifier: integrationIdentifier(),
    client_reference_id: String(options.userId),
    ...(options.customerId
      ? { customer: options.customerId }
      : options.email ? { customer_email: options.email } : {}),
    line_items: [{ price: options.priceId, quantity: 1 }],
    subscription_data: {
      metadata: { meadtools_user_id: String(options.userId) },
    },
    metadata: { premium_user_id: String(options.userId) },
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
  };
}
