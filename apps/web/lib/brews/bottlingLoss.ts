import { isValidLossPercentage } from "@meadtools/core/loss";
import {
  getEntryTimestamp,
  getMeasuredSecondaryVolumeState,
  type BrewTimelineEntry
} from "./stabilizerVolume";

type BottlingVolumeSource =
  | "adjusted_measurement"
  | "recipe_estimate"
  | "measurement"
  | "fallback"
  | "none";

export function hasCurrentPostAdditionMeasurement({
  entries,
  currentVolumeL,
  secondaryIngredientIds,
  loggedIngredientIds
}: {
  entries: BrewTimelineEntry[];
  currentVolumeL: number | null;
  secondaryIngredientIds: string[];
  loggedIngredientIds: string[];
}): boolean {
  if (currentVolumeL === null || !Number.isFinite(currentVolumeL) || currentVolumeL <= 0) {
    return false;
  }
  if (secondaryIngredientIds.length === 0) return true;
  if (!secondaryIngredientIds.every((id) => loggedIngredientIds.includes(id))) {
    return false;
  }

  const latestVolume = entries
    .filter((entry) => entry.type === "VOLUME" && getEntryTimestamp(entry) !== null)
    .sort((a, b) => (getEntryTimestamp(b) ?? 0) - (getEntryTimestamp(a) ?? 0))[0];
  const latestLiters = (latestVolume?.data as { liters?: unknown } | null)?.liters;
  if (
    typeof latestLiters !== "number" ||
    !Number.isFinite(latestLiters) ||
    Math.abs(latestLiters - currentVolumeL) > 0.01
  ) {
    return false;
  }

  return getMeasuredSecondaryVolumeState({
    entries,
    secondaryIngredientIds,
    allSecondaryIngredientsLogged: true
  }).hasMeasuredVolume;
}

export function getBottlingVolumePrefill({
  currentVolumeL,
  effectiveVolumeL,
  recipeBottlingVolumeL,
  secondaryLossPercentage,
  hasPostAdditionMeasurement
}: {
  currentVolumeL: number | null;
  effectiveVolumeL: number | null;
  recipeBottlingVolumeL: number | null;
  secondaryLossPercentage: number | null;
  hasPostAdditionMeasurement: boolean;
}): { volumeL: number | null; source: BottlingVolumeSource } {
  const validVolume = (value: number | null): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
  const hasLoss = secondaryLossPercentage !== null &&
    isValidLossPercentage(secondaryLossPercentage);

  if (hasLoss && validVolume(currentVolumeL) && hasPostAdditionMeasurement) {
    return {
      volumeL: currentVolumeL * (1 - secondaryLossPercentage / 100),
      source: "adjusted_measurement"
    };
  }
  if (validVolume(currentVolumeL)) {
    return { volumeL: currentVolumeL, source: "measurement" };
  }
  if (hasLoss && validVolume(recipeBottlingVolumeL)) {
    return { volumeL: recipeBottlingVolumeL, source: "recipe_estimate" };
  }
  if (validVolume(effectiveVolumeL)) {
    return { volumeL: effectiveVolumeL, source: "fallback" };
  }
  return { volumeL: null, source: "none" };
}
