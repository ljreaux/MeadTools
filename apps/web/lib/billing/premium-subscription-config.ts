import { PREMIUM_MONTHLY_PRICE_CENTS } from "@meadtools/premium-domain";

/** The local switch stays off in production until the full bundle is ready. */
export function arePremiumSubscriptionsAvailable(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.PREMIUM_SUBSCRIPTIONS_ENABLED === "true" &&
    Boolean(env.STRIPE_SECRET_KEY?.trim()) &&
    Boolean(env.STRIPE_WEBHOOK_SECRET?.trim()) &&
    /^price_[A-Za-z0-9]+$/.test(env.STRIPE_PREMIUM_PRICE_ID ?? "")
  );
}

export function getPremiumStripePriceId(env: Record<string, string | undefined> = process.env): string | null {
  const priceId = env.STRIPE_PREMIUM_PRICE_ID?.trim();
  return priceId && /^price_[A-Za-z0-9]+$/.test(priceId) ? priceId : null;
}

export const PREMIUM_STRIPE_MINIMUM_PAID_CENTS = PREMIUM_MONTHLY_PRICE_CENTS;
