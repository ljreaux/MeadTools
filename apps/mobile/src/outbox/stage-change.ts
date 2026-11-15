import type { BrewStage } from "@meadtools/brew-domain";
import type { StageContext, TrackerStage } from "@meadtools/brew-domain/stage-flow";

import type { BrewEntryOutboxRecord, EnqueueEntryInput } from "./entry-outbox-record";
import { findOriginalGravity } from "./gravity-entry-form";

type StageEntryLike = {
  type: string;
  datetime: string | null;
  gravity: number | null;
  data: unknown;
};

type StageBrewLike = {
  stage: BrewStage;
  recipe_id: number | null;
  current_volume_liters: number | null;
  entries: readonly StageEntryLike[];
};

/** Queued stage changes that may still apply, oldest first. */
function pendingStageChanges(records: readonly BrewEntryOutboxRecord[]) {
  return records.filter(
    (record) =>
      record.request.type === "STAGE_CHANGE" &&
      record.delivery.status !== "terminal_failure" &&
      record.delivery.status !== "synchronized"
  );
}

/**
 * The stage the brew will be in once queued changes sync: the latest
 * deliverable queued change, or the server's stage. A new change is queued
 * with this as its expected stage, so chained offline moves apply in order.
 */
export function effectiveStage(
  serverStage: BrewStage,
  records: readonly BrewEntryOutboxRecord[]
): BrewStage {
  const pending = pendingStageChanges(records);
  return (pending.at(-1)?.request.stage_to as BrewStage | undefined) ?? serverStage;
}

/** True when a queued stage change has not synchronized yet. */
export function hasPendingStageChange(records: readonly BrewEntryOutboxRecord[]) {
  return pendingStageChanges(records).length > 0;
}

/**
 * The stage at a given time, for labelling queued rows: the latest
 * deliverable queued change at or before `time`, otherwise `fallback`.
 */
export function stageAt(
  time: string,
  fallback: BrewStage | null,
  records: readonly BrewEntryOutboxRecord[]
): BrewStage | null {
  const at = Date.parse(time);
  let stage = fallback;
  for (const record of pendingStageChanges(records)) {
    if (Date.parse(record.measuredAt) <= at) stage = record.request.stage_to as BrewStage;
  }
  return stage;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Builds the shared stage-move context like the web tracker, counting
 * readings and volumes queued on this device so offline work unblocks a move.
 */
export function stageContextFor(
  brew: StageBrewLike,
  records: readonly BrewEntryOutboxRecord[]
): StageContext {
  const unsent = records.filter((record) => record.delivery.status !== "terminal_failure");
  const queuedEntries: StageEntryLike[] = unsent.map((record) => ({
    type: record.request.type,
    datetime: record.measuredAt,
    gravity: record.request.gravity ?? null,
    data: record.request.data ?? null
  }));
  const packaging = brew.entries.find((entry) => entry.type === "PACKAGING");
  const packagedLiters = (packaging?.data as { packagedVolumeLiters?: unknown } | null)?.packagedVolumeLiters;
  const queuedVolume = unsent.some((record) => {
    const liters = (record.request.data as { liters?: unknown } | null | undefined)?.liters;
    return record.request.type === "VOLUME" && finite(liters) && liters > 0;
  });
  const hasCurrentVolume =
    (finite(brew.current_volume_liters) && brew.current_volume_liters > 0) || queuedVolume;

  return {
    hasRecipeLinked: brew.recipe_id !== null,
    hasOriginalGravity: findOriginalGravity([...brew.entries, ...queuedEntries]) !== null,
    hasPackagingEntry: packaging !== undefined,
    hasPackagedVolume: (finite(packagedLiters) && packagedLiters > 0) || hasCurrentVolume
  };
}

/** A queued stage change that only applies while the brew is still in `from`. */
export function buildStageChangeInput({
  brewId,
  to,
  from,
  measuredAt
}: {
  brewId: string;
  to: TrackerStage;
  from: BrewStage;
  measuredAt: Date;
}): EnqueueEntryInput {
  const datetime = measuredAt.toISOString();
  return {
    brewId,
    payload: { type: "STAGE_CHANGE", stage_to: to, expected_stage: from, datetime }
  };
}
