import { PREMIUM_MONTHLY_PRICE_CENTS, PREMIUM_PLANS, type PremiumBillingInterval } from "@meadtools/premium-domain";

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

export function getPremiumPlanPriceId(interval: PremiumBillingInterval, env: Record<string, string | undefined> = process.env): string | null {
  if (interval === "month") return getPremiumStripePriceId(env);
  const value = env.STRIPE_PREMIUM_ANNUAL_PRICE_ID?.trim();
  // Two different billing periods must never resolve to the same configured Price.
  return value && /^price_[A-Za-z0-9]+$/.test(value) && value !== getPremiumStripePriceId(env) ? value : null;
}

export function areAnnualPremiumSubscriptionsAvailable(env: Record<string, string | undefined> = process.env): boolean {
  return arePremiumSubscriptionsAvailable(env) && env.PREMIUM_ANNUAL_SUBSCRIPTIONS_ENABLED === "true" &&
    Boolean(getPremiumPlanPriceId("year", env));
}

/** Renewal verification does not depend on whether new sales are enabled. */
export function premiumPlanForPriceId(priceId: string, env: Record<string, string | undefined> = process.env) {
  for (const interval of ["month", "year"] as const) {
    if (getPremiumPlanPriceId(interval, env) === priceId) return { interval, priceId, ...PREMIUM_PLANS[interval] };
  }
  return null;
}
