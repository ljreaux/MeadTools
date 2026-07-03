export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type BrewStage =
  | "PLANNED"
  | "PRIMARY"
  | "SECONDARY"
  | "BULK_AGE"
  | "PACKAGED"
  | "COMPLETE";

export type BrewEntryType =
  | "NOTE"
  | "TASTING"
  | "ISSUE"
  | "GRAVITY"
  | "VOLUME"
  | "TEMPERATURE"
  | "PH"
  | "STAGE_CHANGE"
  | "PACKAGING"
  | "ADDITION";

export type GravityUnit = "SG" | "BRIX";
export type TemperatureUnit = "C" | "F" | "K";
export type DateValue = Date | string;

export type BrewViewOwner = {
  displayName: string;
};

export type BrewViewEntrySource<TData = JsonValue> = {
  id: string;
  datetime: DateValue;
  type: string;
  title: string | null;
  note: string | null;
  gravity: number | null;
  temperature: number | null;
  temp_units: string | null;
  data: TData | null;
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

export type BrewViewSource<TData = JsonValue> = {
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
  recipe_snapshot?: unknown;
  entry_count: number;
  owner?: BrewViewOwner | null;
  entries?: BrewViewEntrySource<TData>[];
  entries_by_stage?: Array<{
    stage: string;
    entries: BrewViewEntrySource<TData>[];
  }>;
  logs?: BrewViewLogSource[];
  user_id?: number | null;
  requested_email_alerts?: boolean | null;
};

export type BrewViewEntry<TData = JsonValue> = {
  id: string;
  datetime: string;
  type: BrewEntryType;
  title: string | null;
  note: string | null;
  gravity: number | null;
  temperature: number | null;
  temp_units: string | null;
  data: TData | null;
};

export type BrewViewLog = {
  datetime: string;
  temperature: number;
  temp_units: TemperatureUnit;
  battery: number | null;
  gravity: number;
  calculated_gravity: number | null;
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

export type BrewViewDetail<TSnapshot = JsonValue, TData = JsonValue> =
  BrewViewListItem & {
    recipe_snapshot: TSnapshot | null;
    entries: BrewViewEntry<TData>[];
    entries_by_stage: Array<{
      stage: BrewStage;
      entries: BrewViewEntry<TData>[];
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

function toIso(value: DateValue) {
  return value instanceof Date ? value.toISOString() : value;
}

export function projectBrewViewEntry<TData = JsonValue>(
  entry: BrewViewEntrySource<TData>
): BrewViewEntry<TData> {
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
    temp_units: log.temp_units as TemperatureUnit,
    battery: log.battery,
    gravity: log.gravity,
    calculated_gravity: log.calculated_gravity
  };
}

export function projectBrewViewListItem<TData = JsonValue>(
  brew: BrewViewSource<TData>
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

export function projectBrewView<
  TSnapshot = JsonValue,
  TData = JsonValue
>(
  brew: BrewViewSource<TData>
): BrewViewDetail<TSnapshot, TData> {
  return {
    ...projectBrewViewListItem(brew),
    recipe_snapshot: (brew.recipe_snapshot as TSnapshot | null | undefined) ?? null,
    entries: (brew.entries ?? []).map(projectBrewViewEntry),
    entries_by_stage: (brew.entries_by_stage ?? []).map((bucket) => ({
      stage: bucket.stage as BrewStage,
      entries: bucket.entries.map(projectBrewViewEntry)
    })),
    logs: (brew.logs ?? []).map(projectBrewViewLog)
  };
}
