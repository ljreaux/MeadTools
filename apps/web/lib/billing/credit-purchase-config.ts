/**
 * Purchase activation has a separate, explicit switch from Stripe credentials.
 * A configured key must never make paid credit purchases visible by itself.
 */
export function areCreditPurchasesAvailable(
  environment: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return environment.CHAT_CREDIT_PURCHASES_ENABLED === "true" &&
    Boolean(environment.STRIPE_SECRET_KEY?.trim()) &&
    Boolean(environment.STRIPE_WEBHOOK_SECRET?.trim());
}
