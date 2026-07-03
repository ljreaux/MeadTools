import type { BrewRecipeSnapshot } from "@/lib/utils/buildBrewRecipeStageData";
import type { Prisma } from "@prisma/client";
import type {
  BrewViewCapabilities as SharedBrewViewCapabilities,
  BrewViewDetail as SharedBrewViewDetail,
  BrewViewEntry as SharedBrewViewEntry,
  BrewViewListItem as SharedBrewViewListItem,
  BrewViewLog as SharedBrewViewLog,
  BrewViewOwner as SharedBrewViewOwner
} from "@meadtools/brew-domain/projection";
export { READ_ONLY_BREW_CAPABILITIES } from "@meadtools/brew-domain/projection";

export type BrewViewCapabilities = SharedBrewViewCapabilities;
export type BrewViewEntry = SharedBrewViewEntry<Prisma.JsonValue>;
export type BrewViewListItem = SharedBrewViewListItem;
export type BrewViewLog = SharedBrewViewLog;
export type BrewViewOwner = SharedBrewViewOwner;
export type BrewViewDetail = SharedBrewViewDetail<
  BrewRecipeSnapshot,
  Prisma.JsonValue
>;
