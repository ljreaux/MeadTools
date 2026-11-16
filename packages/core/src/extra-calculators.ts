import { toSG, toBrix, calcABV, refractometerCorrectedSg } from "./gravity";
import { temperatureCorrection, toFahrenheit } from "./temperature";

/** Standalone calculator math shared by the web UI and agent adapters.
 * Conversion constants intentionally match the original calculators.
 */
export function estimatedOriginalGravity(
  hydrometerFg: number,
  refractometerFgBrix: number
) {
  return (
    Math.round(
      (-1.728 * hydrometerFg + 0.01085 * refractometerFgBrix + 2.728) * 1000
    ) / 1000
  );
}

export function sulfiteAddition(
  volume: number,
  unit: "gal" | "lit",
  ppm: number,
  type: "kMeta" | "naMeta"
) {
  const liters = unit === "gal" ? volume * 3.785 : volume;
  return {
    sulfiteGrams: (liters * ppm) / (type === "kMeta" ? 570 : 674),
    campdenTablets: (ppm / 75) * (unit === "gal" ? volume : volume / 3.785)
  };
}

export function sorbateAddition(
  volume: number,
  unit: "gal" | "lit",
  abv: number
) {
  return (
    ((-abv * 25 + 400) / 0.75) *
    (unit === "gal" ? volume * 0.003785411784 : volume / 1000)
  );
}

export function primingSugarBase(
  temperatureF: number,
  co2Volumes: number,
  volumeGallons: number
) {
  return (
    15.195 *
    volumeGallons *
    (co2Volumes -
      3.0378 +
      5.0062e-2 * temperatureF -
      2.6555e-4 * temperatureF ** 2)
  );
}

export const primingBottleSizes = [
  { size: 12, label: "12 oz" },
  { size: 22, label: "22 oz" },
  { size: 11.1586, label: "330 ml" },
  { size: 16.907, label: "500 ml" },
  { size: 25.3605, label: "750 ml" }
].map((item) => ({ ...item, size: item.size * 0.0078125 }));

export function benchTrial(
  stockVolumeMl: number,
  concentrationPercent: number,
  sampleMl: number,
  batchSize: number,
  unit: "gallon" | "liter"
) {
  const adjunctAmount =
    Math.round(stockVolumeMl * concentrationPercent * 1e6) / 1e8;
  const concentration =
    Math.round((adjunctAmount / (sampleMl + stockVolumeMl)) * 1e6) / 1e6;
  const scaledAdjunct =
    unit === "gallon"
      ? Math.round(concentration * 37850000) / 1e4
      : Math.round(concentration * 1e4) / 10;
  return {
    adjunctAmount,
    adjunctConcentration: concentration * 1e6,
    scaledAdjunct,
    scaledBatch: Math.round(scaledAdjunct * batchSize * 1e4) / 1e4
  };
}

export const L_PER_GAL = 3.78541;
export const FL_OZ_PER_L = 33.814;
export const BOTTLE_SIZES_L: Record<string, number> = {
  "12oz": 0.355,
  "187ml": 0.187,
  "330ml": 0.33,
  "375ml": 0.375,
  "500ml": 0.5,
  "22oz": 0.65,
  "750ml": 0.75,
  "1L": 1,
  "1.5L": 1.5,
  "3L": 3,
  "5gal": 18.9271,
  "Oxebar 20L": 20,
  "Oxebar 8L": 8,
  "Oxebar 4L": 4
};
export function bottleVolumeLiters(
  value: number,
  unit: "fl_oz" | "ml" | "liter" | "gallon"
) {
  if (unit === "liter") return value;
  if (unit === "ml") return value / 1000;
  if (unit === "gallon") return value * L_PER_GAL;
  return value / FL_OZ_PER_L;
}
export function bottlesToFill(neededLiters: number, bottleLiters: number) {
  return Math.max(0, Math.ceil(neededLiters / bottleLiters));
}
export function bottleBreakdown(
  targetLiters: number,
  rows: { sizeLiters: number; quantity: number }[]
) {
  return bottleTotals(
    targetLiters,
    rows.map((row) => row.sizeLiters * row.quantity)
  );
}

export function bottleTotals(targetLiters: number, allocatedLiters: number[]) {
  const totalBottledLiters = allocatedLiters.reduce(
    (sum, liters) => sum + liters,
    0
  );
  return {
    totalBottledLiters,
    remainingLiters: targetLiters - totalBottledLiters
  };
}

/** Label-based estimate, not a measured juice density. */
export function juiceLabelEstimate(
  sugar: number,
  sugarUnit: "g" | "mg",
  servingSize: number,
  servingUnit: "ml" | "floz",
  servings: number
) {
  const sugarGrams = sugarUnit === "mg" ? sugar * 0.001 : sugar;
  const servingMl =
    servingUnit === "floz" ? servingSize * 29.5735 : servingSize;
  const calculated = Math.round((sugarGrams / servingMl) * 100 * 1000) / 1000;
  const brix =
    !Number.isFinite(calculated) || servingMl <= 0 || calculated > 1000
      ? 0
      : calculated;
  const total = Math.round(sugar * servings * 1000) / 1000;
  return {
    brix,
    specificGravity: Math.round(toSG(brix) * 1000) / 1000,
    totalSugar: Number.isFinite(total) ? total : 0
  };
}

export function sulfitePpmForPh(phReading: number) {
  const ph = Math.round(phReading * 10) / 10;
  if (ph <= 2.9) return 11;
  if (ph >= 3.9) return 123;
  return (
    (
      {
        3: 13,
        3.1: 16,
        3.2: 21,
        3.3: 26,
        3.4: 32,
        3.5: 39,
        3.6: 50,
        3.7: 63,
        3.8: 98
      } as Record<number, number>
    )[ph] ?? 50
  );
}

/** Match the standalone ABV display's treatment of negative zero and nonfinite math. */
export function standaloneAlcohol(
  originalGravity: number,
  finalGravity: number
) {
  const rawAbv = calcABV(originalGravity, finalGravity);
  const normalize = (value: number) =>
    !Number.isFinite(value) || Math.abs(value) < 1e-10 ? 0 : value;
  return {
    abvPercent: normalize(rawAbv),
    delle: normalize(toBrix(finalGravity) + 4.5 * rawAbv)
  };
}

export type GravityScale = "SG" | "Brix";
export type TemperatureScale = "F" | "C";

/** Converts a reading on either scale to specific gravity. */
export function gravityToSg(value: number, scale: GravityScale) {
  return scale === "Brix" ? toSG(value) : value;
}

/** Converts a reading on either scale to Brix. */
export function gravityToBrix(value: number, scale: GravityScale) {
  return scale === "Brix" ? value : toBrix(value);
}

/** Refractometer correction calculator: corrected FG and the resulting ABV. */
export function refractometerCorrection(input: {
  originalGravity: number;
  originalGravityScale: GravityScale;
  finalGravity: number;
  finalGravityScale: GravityScale;
  correctionFactor: number;
}) {
  const ogBrix = gravityToBrix(input.originalGravity, input.originalGravityScale);
  const fgBrix = gravityToBrix(input.finalGravity, input.finalGravityScale);
  const correctedSg = refractometerCorrectedSg(
    ogBrix,
    fgBrix,
    input.correctionFactor
  );
  const originalGravitySg = gravityToSg(
    input.originalGravity,
    input.originalGravityScale
  );
  return {
    correctedSg,
    correctedBrix: toBrix(correctedSg),
    originalGravitySg,
    ...standaloneAlcohol(originalGravitySg, correctedSg)
  };
}

/** Hydrometer temperature correction with either temperature scale. */
export function temperatureCorrectedGravity(input: {
  measuredSg: number;
  currentTemp: number;
  calibrationTemp: number;
  scale: TemperatureScale;
}) {
  const toF = (value: number) =>
    input.scale === "C" ? toFahrenheit(value) : value;
  const sg = temperatureCorrection(
    input.measuredSg,
    toF(input.currentTemp),
    toF(input.calibrationTemp)
  );
  return { sg, brix: toBrix(sg) };
}

/** Estimated OG from hydrometer and refractometer final readings, with ABV. */
export function estimatedOriginalGravityResult(
  hydrometerFg: number,
  refractometerFgBrix: number
) {
  const sg = estimatedOriginalGravity(hydrometerFg, refractometerFgBrix);
  return {
    sg,
    brix: toBrix(sg),
    ...standaloneAlcohol(sg, hydrometerFg)
  };
}

/** The ABV result is outside what fermentation can produce (the web highlights it). */
export function isImplausibleAbv(abvPercent: number) {
  const shown = Number(abvPercent.toFixed(2));
  return shown < 0 || shown > 23;
}

export type StabilizerVolumeUnit = "gal" | "lit";
export type MetabisulfiteType = "kMeta" | "naMeta";

/** pH the stabilizer calculator assumes when no reading is taken. */
export const DEFAULT_STABILIZER_PH = 3.6;

/** Above this ABV the sorbate formula gives zero or a negative amount. */
export const SORBATE_MAX_ABV = 16;

/**
 * Converts a typed batch volume when its unit changes, with the stabilizer
 * calculators' 3.785 L/gal factor and 3-decimal rounding.
 */
export function convertStabilizerVolume(
  volume: number,
  from: StabilizerVolumeUnit,
  to: StabilizerVolumeUnit
) {
  if (from === to) return volume;
  const converted = to === "lit" ? volume * 3.785 : volume / 3.785;
  return Math.round(converted * 1000) / 1000;
}

/**
 * The main stabilizer calculator: sorbate for the ABV, and sulfite for the
 * pH (or the default pH when no reading is taken).
 */
export function stabilizerAdditions(input: {
  volume: number;
  unit: StabilizerVolumeUnit;
  abv: number;
  ph: number | null;
  type: MetabisulfiteType;
}) {
  const sulfitePpm = sulfitePpmForPh(input.ph ?? DEFAULT_STABILIZER_PH);
  return {
    sorbateGrams: sorbateAddition(input.volume, input.unit, input.abv),
    sulfitePpm,
    ...sulfiteAddition(input.volume, input.unit, sulfitePpm, input.type)
  };
}

/** Inputs the priming sugar calculator accepts without flagging them. */
export const PRIMING_TEMPERATURE_RANGE = {
  F: { min: 32, max: 110 },
  C: { min: 0, max: 44 }
} as const satisfies Record<TemperatureScale, { min: number; max: number }>;
export const PRIMING_CO2_RANGE = { min: 0, max: 6 } as const;

export type PrimingSugarOption = {
  /** Ingredient name as stored (the web translates it by its camelCase key). */
  label: string;
  /** Grams of this ingredient per gram of fermentable sugar. */
  amount: number;
};

/**
 * Priming sugar choices from the ingredient catalog's `sugar` category:
 * Table and Corn Sugar first, then the rest alphabetically.
 */
export function primingSugarOptions(
  ingredients: readonly { name: string; sugar_content: string; category?: string }[]
): PrimingSugarOption[] {
  const isPriority = (label: string) => label === "Table Sugar" || label === "Corn Sugar";
  return ingredients
    .filter((ingredient) => ingredient.category === undefined || ingredient.category === "sugar")
    .map((ingredient) => ({ label: ingredient.name, amount: 100 / parseFloat(ingredient.sugar_content) }))
    .sort((a, b) => {
      const aPri = isPriority(a.label);
      const bPri = isPriority(b.label);
      if (aPri && !bPri) return -1;
      if (!aPri && bPri) return 1;
      return a.label.localeCompare(b.label);
    });
}

/**
 * Grams of each sugar for the batch and per bottle, as in the web priming
 * sugar table. Temperature and volume may use either unit.
 */
export function primingSugarTable(input: {
  temperature: number;
  temperatureScale: TemperatureScale;
  co2Volumes: number;
  volume: number;
  volumeUnit: "gal" | "lit";
  sugars: readonly PrimingSugarOption[];
}) {
  const volumeGallons = input.volumeUnit === "gal" ? input.volume : input.volume / L_PER_GAL;
  const temperatureF = input.temperatureScale === "F" ? input.temperature : toFahrenheit(input.temperature);
  const baseSugar = primingSugarBase(temperatureF, input.co2Volumes, volumeGallons);

  return input.sugars.map((sugar) => {
    const totalGrams = sugar.amount * baseSugar;
    return {
      label: sugar.label,
      totalGrams,
      perBottle: primingBottleSizes.map(({ label, size }) => {
        const bottles = volumeGallons / size;
        return { label, grams: bottles > 0 ? totalGrams / bottles : 0 };
      })
    };
  });
}

/** Within this many gallons or liters of the target, a bottling plan is complete. */
export const BOTTLING_TOLERANCE = 0.1;

/** Status of a bottling plan from the remaining volume in the batch's unit. */
export function bottlingStatus(remaining: number): "ok" | "warn" | "error" {
  if (Math.abs(remaining) <= BOTTLING_TOLERANCE) return "ok";
  return remaining > 0 ? "warn" : "error";
}

/**
 * Bottles of one size still needed to reach the target, counting what the
 * other rows already hold (0 when the target is met or the size is unusable).
 */
export function bottlesToFinish(input: {
  targetLiters: number;
  bottledLiters: number;
  rowLiters: number;
  perBottleLiters: number;
}) {
  const neededLiters = input.targetLiters - (input.bottledLiters - input.rowLiters);
  // Written as "not greater than" so an unreadable (NaN) volume also gives 0.
  if (!Number.isFinite(input.perBottleLiters) || !(input.perBottleLiters > 0) || !(neededLiters > 0)) return 0;
  return bottlesToFill(neededLiters, input.perBottleLiters);
}
