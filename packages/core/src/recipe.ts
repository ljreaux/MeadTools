import { blendValues } from "./blend";
import { toSG } from "./gravity";
import { isValidNumber, parseNumber } from "./numeric";

export type WeightUnit = "kg" | "g" | "lb" | "oz";
export type VolumeUnit =
  | "L"
  | "mL"
  | "gal"
  | "qt"
  | "pt"
  | "fl_oz"
  | "imp_gal"
  | "imp_qt"
  | "imp_pt"
  | "imp_fl_oz";

export type BlendInput = {
  sg: number;
  volumeL: number;
};

export type IngredientLineInput = {
  lineId: string;
  secondary: boolean;
  category: string;
  brix: string;
  amounts: {
    weight: {
      value: string;
      unit: WeightUnit;
    };
    volume: {
      value: string;
      unit: VolumeUnit;
    };
  };
};

export type NormalizedIngredientLine = {
  lineId: string;
  secondary: boolean;
  category: string;
  sg: number;
  brix: number;
  weightKg: number;
  volumeL: number;
};

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
  fl_oz: 0.0295735295625,
  imp_gal: 4.54609,
  imp_qt: 1.1365225,
  imp_pt: 0.56826125,
  imp_fl_oz: 0.0284130625
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
  fl_oz: 33.8140227,
  imp_gal: 0.2199692483,
  imp_qt: 0.879876993,
  imp_pt: 1.759753986,
  imp_fl_oz: 35.19507973
};

export const fmt = (value: number) =>
  Number.isFinite(value) ? value.toFixed(3) : "0.000";

export function normalizeIngredientLine(
  line: IngredientLineInput
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

export function calculateBlend(inputs: BlendInput[]) {
  if (inputs.length === 0) return { sg: 1, volumeL: 0 };

  const { blendedValue, totalVolume } = blendValues(
    inputs.map((input) => [input.sg, input.volumeL])
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

export function isEffectivelyEmptyNumericInput(value: string) {
  const trimmed = value.trim();
  return trimmed === "" || /^0+(?:[.,٫]0+)?$/.test(trimmed);
}

export const HONEY_BRIX = 79.6;

export function calculateHoneyAndWaterL(
  desiredOg: number,
  totalVolumeL: number
) {
  const honeyOg = toSG(HONEY_BRIX);
  const waterOg = toSG(0);

  if (desiredOg < waterOg || desiredOg > honeyOg) {
    throw new Error(
      `The desired OG (${desiredOg}) must be between ${waterOg} and ${honeyOg}.`
    );
  }

  const honeyL = ((desiredOg - waterOg) * totalVolumeL) / (honeyOg - waterOg);
  return {
    honeyL,
    waterL: totalVolumeL - honeyL
  };
}

export type AdditiveUnit =
  | "g"
  | "ml"
  | "tsp"
  | "oz"
  | "units"
  | "mg"
  | "kg"
  | "lbs"
  | "liters"
  | "fl_oz"
  | "quarts"
  | "gal"
  | "tbsp";

export type UnitDim = "weight" | "volume" | "count" | "unknown";

export function getAdditiveUnitDim(unit: string): UnitDim {
  if (["mg", "g", "kg", "oz", "lbs"].includes(unit)) return "weight";
  if (
    ["ml", "liters", "fl_oz", "tsp", "tbsp", "quarts", "gal"].includes(unit)
  ) {
    return "volume";
  }
  if (unit === "units") return "count";
  return "unknown";
}

export const WEIGHT_TO_G = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lbs: 453.59237
} as const;

export const VOLUME_TO_ML = {
  ml: 1,
  liters: 1000,
  fl_oz: 29.5735295625,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  quarts: 946.352946,
  gal: 3785.411784
} as const;

export function convertAdditiveAmount(args: {
  amountStr: string;
  fromUnit: string;
  toUnit: string;
}) {
  const { amountStr, fromUnit, toUnit } = args;
  if (!isValidNumber(amountStr)) return amountStr;

  const fromDim = getAdditiveUnitDim(fromUnit);
  const toDim = getAdditiveUnitDim(toUnit);
  if (fromDim !== toDim) return amountStr;
  if (fromDim === "count" || fromDim === "unknown") return amountStr;

  const value = parseNumber(amountStr);
  if (!Number.isFinite(value)) return amountStr;

  if (fromDim === "weight") {
    const from = WEIGHT_TO_G[fromUnit as keyof typeof WEIGHT_TO_G];
    const to = WEIGHT_TO_G[toUnit as keyof typeof WEIGHT_TO_G];
    return from && to ? fmt((value * from) / to) : amountStr;
  }

  const from = VOLUME_TO_ML[fromUnit as keyof typeof VOLUME_TO_ML];
  const to = VOLUME_TO_ML[toUnit as keyof typeof VOLUME_TO_ML];
  return from && to ? fmt((value * from) / to) : amountStr;
}

export function dosageToAmount(args: {
  dosage: number;
  totalVolumeL: number;
}) {
  return fmt(args.dosage * args.totalVolumeL * L_TO_VOLUME.gal);
}

export function shouldConvertAdditiveAmount(args: {
  amountStr: string;
  fromUnit: string;
  toUnit: string;
  amountTouched: boolean;
  amountDim: UnitDim;
}) {
  if (!isValidNumber(args.amountStr)) return false;
  const fromDim = getAdditiveUnitDim(args.fromUnit);
  const toDim = getAdditiveUnitDim(args.toUnit);
  if (fromDim !== toDim) return false;
  if (fromDim === "count" || fromDim === "unknown") return false;
  return args.amountTouched || args.amountDim === fromDim;
}

export function inferAdditiveAmountDimFromUnit(unit: string): UnitDim {
  return getAdditiveUnitDim(unit);
}

export function nextAdditiveAmountDimOnUnitChange(args: {
  fromUnit: string;
  toUnit: string;
  prevAmountDim: UnitDim;
}) {
  return getAdditiveUnitDim(args.fromUnit) === getAdditiveUnitDim(args.toUnit)
    ? args.prevAmountDim
    : ("unknown" as const);
}
