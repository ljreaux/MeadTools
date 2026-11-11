import "server-only";
import type Stripe from "stripe";

export const PREMIUM_BILLING_POLICY = "renewal-only-v1";

/** Separate configuration preserves existing account settings and prevents immediate plan switches. */
export async function premiumPortalConfiguration(stripe: Stripe): Promise<string> {
  for await (const config of stripe.billingPortal.configurations.list({ active: true, limit: 100 })) {
    if (config.metadata?.meadtools_premium_policy === PREMIUM_BILLING_POLICY &&
        !config.features.subscription_update.enabled && config.features.subscription_cancel.enabled &&
        config.features.subscription_cancel.mode === "at_period_end") return config.id;
  }
  const config = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Manage MeadTools Premium" },
    metadata: { meadtools_premium_policy: PREMIUM_BILLING_POLICY },
    features: {
      customer_update: { enabled: false }, invoice_history: { enabled: true },
      payment_method_update: { enabled: true }, subscription_update: { enabled: false },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
    },
  }, { idempotencyKey: "meadtools-premium-portal-renewal-only-v1" });
  return config.id;
}
