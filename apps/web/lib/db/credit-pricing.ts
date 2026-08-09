import "server-only";

import type { CreditFeePolicy, ModelTokenPricing } from "@meadtools/credit-accounting";
import prisma from "@/lib/prisma";

export class CreditPricingNotConfiguredError extends Error {
  constructor() {
    super("No active credit pricing is configured for this provider model.");
    this.name = "CreditPricingNotConfiguredError";
  }
}

export class CreditFeePolicyNotConfiguredError extends Error {
  constructor() {
    super("No active credit fee policy is configured.");
    this.name = "CreditFeePolicyNotConfiguredError";
  }
}

export type ActiveCreditPricing = {
  id: string;
  provider: string;
  model: string;
  version: string;
  effectiveAt: Date;
  pricing: ModelTokenPricing;
};

export type ActiveCreditFeePolicy = {
  id: string;
  version: string;
  effectiveAt: Date;
  policy: CreditFeePolicy;
};

/** Gets the active immutable provider-price snapshot for a model at a point in time. */
export async function getActiveCreditPricing(options: {
  provider: string;
  model: string;
  at?: Date;
}): Promise<ActiveCreditPricing> {
  const at = options.at ?? new Date();
  const version = await prisma.credit_pricing_versions.findFirst({
    where: {
      provider: options.provider,
      model: options.model,
      effective_at: { lte: at },
      OR: [{ retired_at: null }, { retired_at: { gt: at } }]
    },
    orderBy: [{ effective_at: "desc" }, { created_at: "desc" }]
  });
  if (!version) throw new CreditPricingNotConfiguredError();

  return {
    id: version.id,
    provider: version.provider,
    model: version.model,
    version: version.version,
    effectiveAt: version.effective_at,
    pricing: {
      uncachedInputPicousdPerMillionTokens: version.uncached_input_picousd_per_million_tokens,
      cachedInputPicousdPerMillionTokens: version.cached_input_picousd_per_million_tokens,
      outputPicousdPerMillionTokens: version.output_picousd_per_million_tokens
    }
  };
}

/** Gets the active immutable customer-pricing policy at a point in time. */
export async function getActiveCreditFeePolicy(options: {
  at?: Date;
} = {}): Promise<ActiveCreditFeePolicy> {
  const at = options.at ?? new Date();
  const version = await prisma.credit_fee_policy_versions.findFirst({
    where: {
      effective_at: { lte: at },
      OR: [{ retired_at: null }, { retired_at: { gt: at } }]
    },
    orderBy: [{ effective_at: "desc" }, { created_at: "desc" }]
  });
  if (!version) throw new CreditFeePolicyNotConfiguredError();

  return {
    id: version.id,
    version: version.version,
    effectiveAt: version.effective_at,
    policy: {
      markupBasisPoints: version.markup_basis_points,
      fixedTurnCredits: version.fixed_turn_credits,
      minimumTurnCredits: version.minimum_turn_credits
    }
  };
}
