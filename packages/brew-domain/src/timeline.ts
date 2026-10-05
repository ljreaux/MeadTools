import type { BrewViewDetail, BrewViewEntry, BrewStage } from "./projection";

export type BrewTimelineDetail =
  | { kind: "gravity"; value: number; role: "OG" | "FG" | "GENERAL" }
  | { kind: "temperature"; value: number; unit: "C" | "F" | "K" }
  | { kind: "ph"; value: number }
  | { kind: "volume"; value: number; unit: string; packages: number | null }
  | { kind: "addition"; name: string | null; amount: number | null; unit: string | null }
  | { kind: "stage"; from: BrewStage | null; to: BrewStage | null };

export type BrewTimelineItem = Pick<BrewViewEntry<unknown>, "id" | "datetime" | "type" | "note"> & {
  title: string | null;
  stage: BrewStage | null;
  detail: BrewTimelineDetail | null;
};

type TimelineBrew<TData> = Pick<BrewViewDetail<unknown, TData>, "entries" | "entries_by_stage">;

const stages = new Set<BrewStage>([
  "PLANNED", "PRIMARY", "SECONDARY", "BULK_AGE", "STABILIZED",
  "BACKSWEETENED", "PACKAGED", "COMPLETE"
]);

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonempty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stage(value: unknown): BrewStage | null {
  return typeof value === "string" && stages.has(value as BrewStage)
    ? value as BrewStage
    : null;
}

function detail(entry: BrewViewEntry<unknown>): BrewTimelineDetail | null {
  const data = object(entry.data);
  switch (entry.type) {
    case "GRAVITY": {
      const value = finite(entry.gravity);
      if (value === null) return null;
      const role = data.readingRole === "OG" || data.readingRole === "FG"
        ? data.readingRole : "GENERAL";
      return { kind: "gravity", value, role };
    }
    case "TEMPERATURE": {
      const value = finite(entry.temperature);
      const unit = entry.temp_units;
      return value !== null && (unit === "C" || unit === "F" || unit === "K")
        ? { kind: "temperature", value, unit }
        : null;
    }
    case "PH": {
      const value = finite(data.ph);
      return value === null ? null : { kind: "ph", value };
    }
    case "VOLUME":
    case "PACKAGING": {
      const displayValue = finite(data.displayValue);
      const displayUnit = nonempty(data.displayUnit);
      const liters = finite(entry.type === "VOLUME" ? data.liters : data.packagedVolumeLiters);
      const value = displayValue !== null && displayUnit ? displayValue : liters;
      if (value === null) return null;
      const packages = entry.type === "PACKAGING" && Array.isArray(data.bottleRows)
        ? data.bottleRows.reduce<number>((sum, row) => {
            const quantity = finite(object(row).quantity);
            return sum + (quantity !== null && quantity > 0 ? quantity : 0);
          }, 0)
        : null;
      return {
        kind: "volume",
        value,
        unit: displayValue !== null && displayUnit ? displayUnit : "L",
        packages: packages !== null && packages > 0 ? packages : null
      };
    }
    case "ADDITION":
    case "NUTRIENT":
      return {
        kind: "addition",
        name: nonempty(data.name) ?? nonempty(entry.title),
        amount: finite(data.amount),
        unit: nonempty(data.unit)
      };
    case "STAGE_CHANGE":
      return { kind: "stage", from: stage(data.from), to: stage(data.to) };
    default:
      return null;
  }
}

/** Read-only, display-safe timeline data shared by clients. Newest entries come first. */
export function projectBrewTimeline<TData>(brew: TimelineBrew<TData>): BrewTimelineItem[] {
  const stageById = new Map<string, BrewStage>();
  for (const bucket of brew.entries_by_stage) {
    for (const entry of bucket.entries) stageById.set(entry.id, bucket.stage);
  }

  return brew.entries
    .filter((entry) => {
      const data = object(entry.data);
      return data.hidden !== true && data.source !== "nutrient_basis" && data.source !== "abv_estimate";
    })
    .map((entry) => ({
      id: entry.id,
      datetime: entry.datetime,
      type: entry.type,
      title: nonempty(entry.title),
      note: nonempty(entry.note),
      stage: stageById.get(entry.id) ?? null,
      detail: detail(entry)
    }))
    .sort((a, b) => {
      const left = Date.parse(a.datetime);
      const right = Date.parse(b.datetime);
      return (Number.isFinite(right) ? right : -Infinity) -
        (Number.isFinite(left) ? left : -Infinity);
    });
}
