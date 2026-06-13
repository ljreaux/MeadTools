import type { Prisma } from "@prisma/client";

import type { BrewEntryType, BrewStage, GravityUnit } from "@/lib/brewEnums";
import type { BrewRecipeSnapshot } from "@/lib/utils/buildBrewRecipeStageData";

export type BrewViewEntry = {
  id: string;
  datetime: string;
  type: BrewEntryType;
  title: string | null;
  note: string | null;
  gravity: number | null;
  temperature: number | null;
  temp_units: string | null;
  data: Prisma.JsonValue | null;
};

export type BrewViewLog = {
  datetime: string;
  temperature: number;
  temp_units: "C" | "F" | "K";
  battery: number | null;
  gravity: number;
  calculated_gravity: number | null;
};

export type BrewViewOwner = {
  displayName: string;
};

export type BrewViewListItem = {
  id: string;
  name: string | null;
  start_date: string;
  end_date: string | null;
  stage: BrewStage;
  batch_number: number | null;
  current_volume_liters: number | null;
  gravity_unit_preference: GravityUnit;
  latest_gravity: number | null;
  public: boolean;
  recipe_id: number | null;
  recipe_name: string | null;
  entry_count: number;
  owner: BrewViewOwner | null;
};

export type BrewViewDetail = BrewViewListItem & {
  recipe_snapshot: BrewRecipeSnapshot | null;
  entries: BrewViewEntry[];
  entries_by_stage: Array<{
    stage: BrewStage;
    entries: BrewViewEntry[];
  }>;
  logs: BrewViewLog[];
};

export type BrewViewCapabilities = {
  canEditMetadata: boolean;
  canManageEntries: boolean;
  canMoveStage: boolean;
  canManageHydrometer: boolean;
};

export const READ_ONLY_BREW_CAPABILITIES: BrewViewCapabilities = {
  canEditMetadata: false,
  canManageEntries: false,
  canMoveStage: false,
  canManageHydrometer: false
};
