import { parseNumber } from "@meadtools/core/numeric";

const EDITABLE_AMOUNT_DECIMALS = 2;

export type AmountValue = {
  value: string | number;
  unit: string;
};

export type IngredientSuggestionLine = {
  lineId: string | number;
  name?: string | null;
  secondary: boolean;
  amounts: {
    basis: "volume" | "weight";
    weight: AmountValue;
    volume: AmountValue;
  };
};

export type AdditiveSuggestionLine = {
  lineId: string | number;
  name?: string | null;
  amount: string | number;
  unit: string;
};

export type ScaledIngredientSuggestion = {
  lineId: string;
  weightAmount: number;
  weightUnit: string;
  volumeAmount: number;
  volumeUnit: string;
  basisAmount: number;
  basisUnit: string;
};

export type ScaledAdditiveSuggestion = {
  lineId: string;
  amount: number;
  unit: string;
};

export function roundEditableAmount(
  value: number,
  decimals = EDITABLE_AMOUNT_DECIMALS
) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function getBrewTrackingScaleRatio(
  currentVolumeL: number | null | undefined,
  recipeBaseVolumeL: number | null | undefined
) {
  if (
    typeof currentVolumeL !== "number" ||
    !Number.isFinite(currentVolumeL) ||
    currentVolumeL <= 0 ||
    typeof recipeBaseVolumeL !== "number" ||
    !Number.isFinite(recipeBaseVolumeL) ||
    recipeBaseVolumeL <= 0
  ) {
    return null;
  }

  return currentVolumeL / recipeBaseVolumeL;
}

export function scaleSecondaryIngredientSuggestions({
  lines,
  loggedIds,
  currentVolumeL,
  recipeBaseVolumeL
}: {
  lines: IngredientSuggestionLine[];
  loggedIds: Set<string>;
  currentVolumeL: number | null | undefined;
  recipeBaseVolumeL: number | null | undefined;
}) {
  const ratio = getBrewTrackingScaleRatio(currentVolumeL, recipeBaseVolumeL);
  if (ratio == null) return new Map<string, ScaledIngredientSuggestion>();

  const scaled = new Map<string, ScaledIngredientSuggestion>();

  for (const line of lines) {
    if (
      !line.secondary ||
      !(line.name ?? "").trim() ||
      loggedIds.has(String(line.lineId))
    ) {
      continue;
    }

    const weightAmount = roundEditableAmount(
      parseNumber(line.amounts.weight.value) * ratio
    );
    const volumeAmount = roundEditableAmount(
      parseNumber(line.amounts.volume.value) * ratio
    );
    const basisAmount =
      line.amounts.basis === "volume" ? volumeAmount : weightAmount;
    const basisUnit =
      line.amounts.basis === "volume"
        ? line.amounts.volume.unit
        : line.amounts.weight.unit;

    scaled.set(String(line.lineId), {
      lineId: String(line.lineId),
      weightAmount,
      weightUnit: line.amounts.weight.unit,
      volumeAmount,
      volumeUnit: line.amounts.volume.unit,
      basisAmount,
      basisUnit
    });
  }

  return scaled;
}

export function scaleAdditiveSuggestions({
  lines,
  loggedIds,
  currentVolumeL,
  recipeBaseVolumeL
}: {
  lines: AdditiveSuggestionLine[];
  loggedIds: Set<string>;
  currentVolumeL: number | null | undefined;
  recipeBaseVolumeL: number | null | undefined;
}) {
  const ratio = getBrewTrackingScaleRatio(currentVolumeL, recipeBaseVolumeL);
  if (ratio == null) return new Map<string, ScaledAdditiveSuggestion>();

  const scaled = new Map<string, ScaledAdditiveSuggestion>();

  for (const line of lines) {
    if (
      !(line.name ?? "").trim() ||
      loggedIds.has(String(line.lineId))
    ) {
      continue;
    }

    scaled.set(String(line.lineId), {
      lineId: String(line.lineId),
      amount: roundEditableAmount(parseNumber(line.amount) * ratio),
      unit: line.unit
    });
  }

  return scaled;
}
