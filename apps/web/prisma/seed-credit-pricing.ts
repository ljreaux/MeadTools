import { config as loadEnvironment } from "dotenv";
import { resolve } from "node:path";
import { currentFireworksDeepseekV4FlashPricing } from "@/lib/billing/credit-pricing";

loadEnvironment({ path: resolve(import.meta.dirname, "../.env.local") });
const { default: prisma } = await import("../lib/prisma");

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Credit-pricing seeding is not available in production.");
  }

  await prisma.credit_pricing_versions.upsert({
    where: {
      provider_model_version: {
        provider: currentFireworksDeepseekV4FlashPricing.provider,
        model: currentFireworksDeepseekV4FlashPricing.model,
        version: currentFireworksDeepseekV4FlashPricing.version
      }
    },
    create: {
      provider: currentFireworksDeepseekV4FlashPricing.provider,
      model: currentFireworksDeepseekV4FlashPricing.model,
      version: currentFireworksDeepseekV4FlashPricing.version,
      uncached_input_picousd_per_million_tokens:
        currentFireworksDeepseekV4FlashPricing.pricing.uncachedInputPicousdPerMillionTokens,
      cached_input_picousd_per_million_tokens:
        currentFireworksDeepseekV4FlashPricing.pricing.cachedInputPicousdPerMillionTokens,
      output_picousd_per_million_tokens:
        currentFireworksDeepseekV4FlashPricing.pricing.outputPicousdPerMillionTokens,
      effective_at: currentFireworksDeepseekV4FlashPricing.effectiveAt
    },
    update: {}
  });

  console.log("Current Fireworks credit pricing seeded.");
}

void main()
  .finally(async () => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
