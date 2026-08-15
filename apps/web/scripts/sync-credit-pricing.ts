import prisma from "../lib/prisma";
import {
  currentCreditFeePolicy,
  initialFireworksDeepseekV4FlashPricing,
  initialOpenAIGpt54MiniPricing
} from "../lib/billing/credit-pricing";

async function main() {
  for (const pricing of [
    initialFireworksDeepseekV4FlashPricing,
    initialOpenAIGpt54MiniPricing
  ]) {
    await prisma.credit_pricing_versions.upsert({
      where: {
        provider_model_version: {
          provider: pricing.provider,
          model: pricing.model,
          version: pricing.version
        }
      },
      create: {
        provider: pricing.provider,
        model: pricing.model,
        version: pricing.version,
        uncached_input_picousd_per_million_tokens:
          pricing.pricing.uncachedInputPicousdPerMillionTokens,
        cached_input_picousd_per_million_tokens:
          pricing.pricing.cachedInputPicousdPerMillionTokens,
        output_picousd_per_million_tokens:
          pricing.pricing.outputPicousdPerMillionTokens,
        effective_at: pricing.effectiveAt
      },
      update: {}
    });
  }

  await prisma.credit_fee_policy_versions.upsert({
    where: { version: currentCreditFeePolicy.version },
    create: {
      version: currentCreditFeePolicy.version,
      markup_basis_points: currentCreditFeePolicy.policy.markupBasisPoints,
      fixed_turn_credits: currentCreditFeePolicy.policy.fixedTurnCredits,
      minimum_turn_credits: currentCreditFeePolicy.policy.minimumTurnCredits,
      effective_at: currentCreditFeePolicy.effectiveAt
    },
    update: {}
  });

  const activePolicy = await prisma.credit_fee_policy_versions.findFirst({
    where: {
      effective_at: { lte: new Date() },
      OR: [{ retired_at: null }, { retired_at: { gt: new Date() } }]
    },
    orderBy: [{ effective_at: "desc" }, { created_at: "desc" }]
  });
  if (activePolicy?.version !== currentCreditFeePolicy.version) {
    throw new Error("The synced credit policy did not become active.");
  }

  console.log(`Credit pricing synced and active: ${activePolicy.version}`);
}

void main()
  .catch((error: unknown) => {
    console.error("Unable to sync credit pricing.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
