import type {
  ModelTokenPricing,
  CreditFeePolicy,
} from "@meadtools/credit-accounting";

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
    outputPicousdPerMillionTokens: BigInt(280_000_000_000),
  } satisfies ModelTokenPricing,
  effectiveAt: new Date("2026-08-08T00:00:00.000Z"),
  sourceUrl: "https://docs.fireworks.ai/serverless/pricing",
} as const;

/**
 * Snapshot of direct OpenAI pricing checked on 2026-08-14. The chatbot uses
 * the dated model ID so a future model upgrade must add a new price version.
 */
export const initialOpenAIGpt54MiniPricing = {
  provider: "openai",
  model: "gpt-5.4-mini-2026-03-17",
  version: "openai-gpt-5.4-mini-2026-03-17-2026-08-14",
  pricing: {
    uncachedInputPicousdPerMillionTokens: BigInt(750_000_000_000),
    cachedInputPicousdPerMillionTokens: BigInt(75_000_000_000),
    outputPicousdPerMillionTokens: BigInt(4_500_000_000_000),
  } satisfies ModelTokenPricing,
  effectiveAt: new Date("2026-08-14T00:00:00.000Z"),
  sourceUrl: "https://openai.com/api/pricing/",
} as const;

/** Standard short-context pricing checked on 2026-10-18 for the Luna evaluation. */
export const initialOpenAIGpt56LunaPricing = {
  provider: "openai",
  model: "gpt-5.6-luna",
  version: "openai-gpt-5.6-luna-standard-2026-10-18",
  pricing: {
    uncachedInputPicousdPerMillionTokens: BigInt(200_000_000_000),
    cachedInputPicousdPerMillionTokens: BigInt(20_000_000_000),
    outputPicousdPerMillionTokens: BigInt(1_200_000_000_000),
  } satisfies ModelTokenPricing,
  effectiveAt: new Date("2026-10-18T00:00:00.000Z"),
  sourceUrl: "https://developers.openai.com/api/docs/models/gpt-5.6-luna",
} as const;

/**
 * Stable customer-facing credit burn policy for beta and paid launch. Changes
 * receive a new immutable version so every settled chat turn remains auditable.
 */
export const currentCreditFeePolicy = {
  version: "standard-75-percent-2026-08-15",
  policy: {
    markupBasisPoints: 7_500,
    fixedTurnCredits: 0,
    minimumTurnCredits: 1,
  } satisfies CreditFeePolicy,
  effectiveAt: new Date("2026-08-15T00:00:00.000Z"),
} as const;
