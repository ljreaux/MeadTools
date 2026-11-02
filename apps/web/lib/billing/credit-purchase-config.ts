import type { CreditPackId } from "@meadtools/credit-accounting";

const PRICE_KEYS: Record<CreditPackId, string> = {
  starter: "STRIPE_CREDIT_PRICE_STARTER",
  standard: "STRIPE_CREDIT_PRICE_STANDARD",
  reserve: "STRIPE_CREDIT_PRICE_RESERVE",
};

/** Production uses reviewed live catalog prices; local sandbox can use inline prices. */
export function getCreditPackPriceId(
  packId: CreditPackId,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null | undefined {
  const priceId = environment[PRICE_KEYS[packId]]?.trim();
  if (priceId && /^price_[a-zA-Z0-9]+$/.test(priceId)) return priceId;
  return environment.VERCEL_ENV === "production" ? null : undefined;
}

/**
 * Purchase activation has a separate, explicit switch from Stripe credentials.
 * A configured key must never make paid credit purchases visible by itself.
 */
export function areCreditPurchasesAvailable(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.CHAT_CREDIT_PURCHASES_ENABLED === "true" &&
    Boolean(environment.STRIPE_SECRET_KEY?.trim()) &&
    Boolean(environment.STRIPE_WEBHOOK_SECRET?.trim()) &&
    (Object.keys(PRICE_KEYS) as CreditPackId[]).every(
      (packId) => getCreditPackPriceId(packId, environment) !== null,
    )
  );
}

/** The purchase gate follows the same hosted-chat access the wallet UI uses. */
export function canUserPurchaseCredits(
  chatEnabled: boolean,
  chatbotConfigured: boolean,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    chatEnabled &&
    chatbotConfigured &&
    areCreditPurchasesAvailable(environment)
  );
}
