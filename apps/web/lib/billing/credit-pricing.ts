import type { ModelTokenPricing, CreditFeePolicy } from "@meadtools/credit-accounting";

/**
 * Snapshot of Fireworks standard-serverless pricing checked on 2026-08-08.
 * Values are picodollars per one million tokens. New provider prices must be
 * added as a new database version rather than mutating this historical value.
 */
export const initialFireworksDeepseekV4FlashPricing = {
  provider: "fireworks",
  model: "accounts/fireworks/models/deepseek-v4-flash",
  version: "fireworks-deepseek-v4-flash-standard-2026-08-08",
  pricing: {
    uncachedInputPicousdPerMillionTokens: BigInt(140_000_000_000),
    cachedInputPicousdPerMillionTokens: BigInt(28_000_000_000),
    outputPicousdPerMillionTokens: BigInt(280_000_000_000)
  } satisfies ModelTokenPricing,
  effectiveAt: new Date("2026-08-08T00:00:00.000Z"),
  sourceUrl: "https://docs.fireworks.ai/serverless/pricing"
} as const;

/**
 * The initial 25% usage markup leaves room for payment processing and a small
 * operating margin. Credit packs remain simple whole-credit purchases.
 */
export const initialCreditFeePolicy = {
  version: "standard-25-percent-2026-08-08",
  policy: {
    markupBasisPoints: 2_500,
    fixedTurnCredits: 0,
    minimumTurnCredits: 1
  } satisfies CreditFeePolicy,
  effectiveAt: new Date("2026-08-08T00:00:00.000Z")
} as const;
