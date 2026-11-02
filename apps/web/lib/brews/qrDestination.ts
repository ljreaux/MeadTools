import type { PrismaClient } from "@prisma/client";
import { brewLinkDestination } from "@meadtools/brew-domain/links";

/** Only public IDs are read here. Owner authorization remains in the account API. */
export async function resolveBrewQrDestination(
  database: Pick<PrismaClient, "brews">,
  brewId: string,
  locale: string,
) {
  // Validate before querying, using the same bounded ID format as generation.
  const ownerDestination = brewLinkDestination(brewId, null, locale);
  const brew = await database.brews.findFirst({
    where: { id: brewId, public: true, recipes: { private: false } },
    select: { recipe_id: true },
  });
  return brew?.recipe_id != null
    ? brewLinkDestination(brewId, brew.recipe_id, locale)
    : ownerDestination;
}
