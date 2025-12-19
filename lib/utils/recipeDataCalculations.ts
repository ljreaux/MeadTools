import {
  BlendInput,
  IngredientLineV2,
  NormalizedIngredientLine,
  VolumeUnit,
  WeightUnit
} from "../../types/recipeDataV2";
import { blendValues } from "./blendValues";
import { toSG } from "./unitConverter";
import { parseNumber } from "./validateInput";

/**
 * Base-unit conversion factors
 * - weight → kg
 * - volume → L
 */
export const WEIGHT_TO_KG: Record<WeightUnit, number> = {
  kg: 1,
  g: 0.001,
  lb: 0.45359237,
  oz: 0.028349523125
};

export const VOLUME_TO_L: Record<VolumeUnit, number> = {
  L: 1,
  mL: 0.001,
  gal: 3.785411784,
  qt: 0.946352946,
  pt: 0.473176473,
  fl_oz: 0.0295735295625
};

export const KG_TO_WEIGHT: Record<WeightUnit, number> = {
  kg: 1,
  g: 1000,
  lb: 2.2046226218,
  oz: 35.27396195
};

export const L_TO_VOLUME: Record<VolumeUnit, number> = {
  L: 1,
  mL: 1000,
  gal: 0.2641720524,
  qt: 1.056688209,
  pt: 2.113376419,
  fl_oz: 33.8140227
};

export const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : "0.000");

/**
 * Convert a single ingredient line into numeric base units
 * suitable for blending math.
 *
 */
export function normalizeIngredientLine(
  line: IngredientLineV2
): NormalizedIngredientLine {
  const brix = parseNumber(line.brix);

  return {
    lineId: line.lineId,
    secondary: line.secondary,
    category: line.category,
    brix,
    sg: toSG(brix),
    weightKg:
      parseNumber(line.amounts.weight.value) *
      WEIGHT_TO_KG[line.amounts.weight.unit],
    volumeL:
      parseNumber(line.amounts.volume.value) *
      VOLUME_TO_L[line.amounts.volume.unit]
  };
}

/**
 * Core blending math.
 * Accepts already-normalized sg + volumeL inputs.
 */
export function calculateBlend(inputs: BlendInput[]) {
  if (inputs.length === 0) {
    return { sg: 1, volumeL: 0 };
  }

  const { blendedValue, totalVolume } = blendValues(
    inputs.map((b) => [b.sg, b.volumeL])
  );

  return {
    sg: blendedValue,
    volumeL: totalVolume
  };
}

export function calculateOriginalGravity(inputs: BlendInput[]) {
  return calculateBlend(inputs).sg;
}

export function calculateVolume(inputs: BlendInput[]) {
  return calculateBlend(inputs).volumeL;
}
