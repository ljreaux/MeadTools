import type { Prisma } from "@prisma/client";

import type { BrewEntryType, BrewStage, GravityUnit } from "@/lib/brewEnums";
import type { BrewRecipeSnapshot } from "@/lib/utils/buildBrewRecipeStageData";
import type {
  BrewViewDetail,
  BrewViewEntry,
  BrewViewListItem,
  BrewViewLog,
  BrewViewOwner
} from "@/types/brewView";

type DateValue = Date | string;

export type BrewViewEntrySource = {
  id: string;
  datetime: DateValue;
  type: string;
  title: string | null;
  note: string | null;
  gravity: number | null;
  temperature: number | null;
  temp_units: string | null;
  data: Prisma.JsonValue | null;
  user_id?: number | null;
};

export type BrewViewLogSource = {
  datetime: DateValue;
  temperature: number;
  temp_units: string;
  battery: number | null;
  gravity: number;
  calculated_gravity: number | null;
  id?: string;
  brew_id?: string | null;
  device_id?: string | null;
};

export type BrewViewSource = {
  id: string;
  name: string | null;
  start_date: DateValue;
  end_date: DateValue | null;
  stage: string;
  batch_number: number | null;
  current_volume_liters: number | null;
  gravity_unit_preference: string;
  latest_gravity: number | null;
  public?: boolean | null;
  recipe_id: number | null;
  recipe_name: string | null;
  recipe_snapshot?: Prisma.JsonValue | null;
  entry_count: number;
  owner?: BrewViewOwner | null;
  entries?: BrewViewEntrySource[];
  entries_by_stage?: Array<{
    stage: string;
    entries: BrewViewEntrySource[];
  }>;
  logs?: BrewViewLogSource[];
  user_id?: number | null;
  requested_email_alerts?: boolean | null;
};

function toIso(value: DateValue) {
  return value instanceof Date ? value.toISOString() : value;
}

export function projectBrewViewEntry(
  entry: BrewViewEntrySource
): BrewViewEntry {
  return {
    id: entry.id,
    datetime: toIso(entry.datetime),
    type: entry.type as BrewEntryType,
    title: entry.title,
    note: entry.note,
    gravity: entry.gravity,
    temperature: entry.temperature,
    temp_units: entry.temp_units,
    data: entry.data
  };
}

export function projectBrewViewLog(log: BrewViewLogSource): BrewViewLog {
  return {
    datetime: toIso(log.datetime),
    temperature: log.temperature,
    temp_units: log.temp_units as BrewViewLog["temp_units"],
    battery: log.battery,
    gravity: log.gravity,
    calculated_gravity: log.calculated_gravity
  };
}

export function projectBrewViewListItem(
  brew: BrewViewSource
): BrewViewListItem {
  return {
    id: brew.id,
    name: brew.name,
    start_date: toIso(brew.start_date),
    end_date: brew.end_date ? toIso(brew.end_date) : null,
    stage: brew.stage as BrewStage,
    batch_number: brew.batch_number,
    current_volume_liters: brew.current_volume_liters,
    gravity_unit_preference: brew.gravity_unit_preference as GravityUnit,
    latest_gravity: brew.latest_gravity,
    public: brew.public ?? false,
    recipe_id: brew.recipe_id,
    recipe_name: brew.recipe_name,
    entry_count: brew.entry_count,
    owner: brew.owner ?? null
  };
}

export function projectBrewView(brew: BrewViewSource): BrewViewDetail {
  return {
    ...projectBrewViewListItem(brew),
    recipe_snapshot:
      (brew.recipe_snapshot as BrewRecipeSnapshot | null | undefined) ?? null,
    entries: (brew.entries ?? []).map(projectBrewViewEntry),
    entries_by_stage: (brew.entries_by_stage ?? []).map((bucket) => ({
      stage: bucket.stage as BrewStage,
      entries: bucket.entries.map(projectBrewViewEntry)
    })),
    logs: (brew.logs ?? []).map(projectBrewViewLog)
  };
}
