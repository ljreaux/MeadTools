import { calcABV } from "@meadtools/core/gravity";
import { parseNumber } from "@meadtools/core/numeric";
import { VOLUME_TO_L, WEIGHT_TO_KG, type VolumeUnit, type WeightUnit } from "@meadtools/core/recipe";

import type { BrewLoggedAddition, BrewRecipeStageData } from "./recipe-stage";
import type { IngredientLine, RecipeUnitDefaults } from "./recipe-snapshot";
import { getEntryTimestamp, getMeasuredSecondaryVolumeState, type BrewTimelineEntry } from "./stabilizer-volume";

type StabilizerContext = {
  brew: { current_volume_liters: number | null; entries: BrewTimelineEntry[] };
  recipe: Pick<BrewRecipeStageData["planned"], "secondaryIngredients" | "stabilizerPlan">
    & Pick<BrewRecipeStageData, "actual" | "derived" | "recipeData">;
};

function latestLoggedItem(items?: BrewLoggedAddition[]) {
  if (!items?.length) return null;
  return [...items].sort((a, b) => (getEntryTimestamp(b) ?? 0) - (getEntryTimestamp(a) ?? 0))[0];
}

export type StabilizerPlan = {
  volumeL: number;
  volumeSource: "current" | "effective_recipe";
  baseVolumeL: number;
  secondaryVolumeL: number;
  adjustedTotalVolumeL: number;
  secondaryVolumeSource: "none" | "logged" | "planned" | "mixed";
  secondaryVolumePartiallyPlanned: boolean;
  abv: number;
  abvSource: "logged_og_fg" | "recipe";
  baseAbv: number;
  dilutedAbv: number;
  defaultPh: string;
  phSource: "latest_logged" | "recipe" | "default";
  stabilizerType: "kmeta" | "nameta";
  volumeUnit: RecipeUnitDefaults["volume"];
};

function getEntryTime(
  entry: BrewTimelineEntry,
) {
  return getEntryTimestamp(entry) ?? 0;
}

function latestLoggedPh(ctx: StabilizerContext) {
  const entry = ctx.brew.entries
    .filter(
      (item) =>
        item.type === "PH" &&
        typeof (item.data as any)?.ph === "number",
    )
    .sort((a, b) => getEntryTime(b) - getEntryTime(a))[0];

  const ph = (entry?.data as any)?.ph;
  return typeof ph === "number" && Number.isFinite(ph) ? ph : null;
}

const weightUnits = new Set<WeightUnit>(["kg", "g", "lb", "oz"]);
const volumeUnits = new Set<VolumeUnit>([
  "L",
  "mL",
  "gal",
  "qt",
  "pt",
  "fl_oz",
  "imp_gal",
  "imp_qt",
  "imp_pt",
  "imp_fl_oz",
]);

function normalizeWeightUnit(unit?: string | null): WeightUnit | null {
  const value = unit?.trim();
  if (!value) return null;
  if (value === "lbs") return "lb";
  return weightUnits.has(value as WeightUnit) ? (value as WeightUnit) : null;
}

function normalizeVolumeUnit(unit?: string | null): VolumeUnit | null {
  const value = unit?.trim();
  if (!value) return null;
  if (value === "liter" || value === "liters") return "L";
  if (value === "ml") return "mL";
  if (value === "quarts") return "qt";
  if (value === "floz") return "fl_oz";
  return volumeUnits.has(value as VolumeUnit) ? (value as VolumeUnit) : null;
}

function plannedSecondaryVolumeL(line: IngredientLine) {
  const amount = parseNumber(line.amounts.volume.value);
  const unit = normalizeVolumeUnit(line.amounts.volume.unit);
  if (!Number.isFinite(amount) || amount <= 0 || !unit) return null;
  return amount * VOLUME_TO_L[unit];
}

function loggedSecondaryVolumeL(
  line: IngredientLine,
  addition?: {
    amount: number | null;
    unit: string | null;
    meta: Record<string, any> | null;
  } | null,
) {
  if (
    !addition ||
    typeof addition.amount !== "number" ||
    !Number.isFinite(addition.amount) ||
    addition.amount <= 0
  ) {
    return null;
  }

  const volumeUnit = normalizeVolumeUnit(addition.unit);
  if (volumeUnit) return addition.amount * VOLUME_TO_L[volumeUnit];

  const weightUnit = normalizeWeightUnit(addition.unit);
  const sg = toIngredientSg(line);
  if (weightUnit && sg != null) {
    return (addition.amount * WEIGHT_TO_KG[weightUnit]) / sg;
  }

  if (addition.meta?.actualBasis === "volume") {
    const metaUnit = normalizeVolumeUnit(addition.meta?.plannedVolumeUnit);
    const metaAmount =
      typeof addition.meta?.plannedVolumeAmount === "number"
        ? addition.meta.plannedVolumeAmount
        : null;
    if (
      metaUnit &&
      metaAmount != null &&
      Number.isFinite(metaAmount) &&
      metaAmount > 0
    )
      return metaAmount * VOLUME_TO_L[metaUnit];
  }

  return null;
}

function toIngredientSg(line: IngredientLine) {
  const brix = parseNumber(line.brix);
  if (!Number.isFinite(brix)) return null;
  const sg =
    1.00001 +
    0.0038661 * brix +
    1.3488 * 10 ** -5 * brix ** 2 +
    4.3074 * 10 ** -8 * brix ** 3;
  return Number.isFinite(sg) && sg > 0 ? sg : null;
}

function getSecondaryVolumeBreakdown(ctx: StabilizerContext) {
  let loggedVolumeL = 0;
  let plannedVolumeL = 0;
  let loggedCount = 0;
  let plannedCount = 0;
  let fallbackCount = 0;

  for (const line of ctx.recipe.secondaryIngredients) {
    if (!(line.name ?? "").trim()) continue;
    const logged = latestLoggedItem(
      ctx.recipe.actual.additionsByRecipeIngredientId[String(line.lineId)],
    );
    const loggedVolume = loggedSecondaryVolumeL(line, logged);
    if (loggedVolume != null) {
      loggedVolumeL += loggedVolume;
      loggedCount += 1;
      continue;
    }

    const plannedVolume = plannedSecondaryVolumeL(line);
    if (plannedVolume != null) {
      plannedVolumeL += plannedVolume;
      plannedCount += 1;
      if (logged) fallbackCount += 1;
    }
  }

  const source =
    loggedCount > 0 && plannedCount > 0
      ? "mixed"
      : loggedCount > 0
        ? "logged"
        : plannedCount > 0
          ? "planned"
          : "none";

  return {
    loggedVolumeL,
    plannedVolumeL,
    totalVolumeL: loggedVolumeL + plannedVolumeL,
    source,
    partiallyPlanned: plannedCount > 0,
    fallbackCount,
  } as const;
}

export function getStabilizerPlan(
  ctx: StabilizerContext,
  formatPh: (ph: number) => string = String,
): StabilizerPlan | null {
  const currentVolume = ctx.brew.current_volume_liters;
  const baseVolumeL =
    typeof currentVolume === "number" &&
    Number.isFinite(currentVolume) &&
    currentVolume > 0
      ? currentVolume
      : null;

  if (baseVolumeL == null) return null;

  const og =
    ctx.recipe.actual.originalGravity?.gravity ??
    ctx.recipe.derived?.gravity.ogPrimary ??
    null;
  const fg =
    ctx.recipe.actual.finalGravity?.gravity ??
    (ctx.recipe.recipeData?.fg != null
      ? parseNumber(String(ctx.recipe.recipeData.fg))
      : null);
  const hasLoggedOgFg = Boolean(
    ctx.recipe.actual.originalGravity && ctx.recipe.actual.finalGravity,
  );
  const loggedAbv =
    typeof og === "number" &&
    Number.isFinite(og) &&
    typeof fg === "number" &&
    Number.isFinite(fg)
      ? calcABV(og, fg)
      : null;
  const abv =
    typeof loggedAbv === "number" && Number.isFinite(loggedAbv)
      ? loggedAbv
      : null;

  if (abv == null) return null;

  const secondaryVolume = getSecondaryVolumeBreakdown(ctx);
  const initialStabilizer = getLoggedStabilizerAdditions(ctx).find(
    (addition) => addition.meta?.supplemental !== true,
  );
  const initialBaseVolumeL =
    typeof initialStabilizer?.meta?.baseVolumeLiters === "number" &&
    Number.isFinite(initialStabilizer.meta.baseVolumeLiters)
      ? initialStabilizer.meta.baseVolumeLiters
      : baseVolumeL;
  const initialBaseAbv =
    typeof initialStabilizer?.meta?.baseAbv === "number" &&
    Number.isFinite(initialStabilizer.meta.baseAbv)
      ? initialStabilizer.meta.baseAbv
      : abv;
  const secondaryIngredientIds = ctx.recipe.secondaryIngredients
    .filter((line) => (line.name ?? "").trim())
    .map((line) => String(line.lineId));
  const measuredSecondaryVolume = getMeasuredSecondaryVolumeState({
    entries: ctx.brew.entries,
    secondaryIngredientIds,
    allSecondaryIngredientsLogged:
      secondaryVolume.source === "logged" && secondaryIngredientIds.length > 0,
  });
  const adjustedTotalVolumeL = measuredSecondaryVolume.hasMeasuredVolume
    ? baseVolumeL
    : baseVolumeL + secondaryVolume.totalVolumeL;
  const dilutedAbv =
    adjustedTotalVolumeL > 0
      ? (initialBaseAbv * initialBaseVolumeL) / adjustedTotalVolumeL
      : initialBaseAbv;

  const latestPh = latestLoggedPh(ctx);
  const recipePh = ctx.recipe.stabilizerPlan?.phReading?.trim();
  const defaultPh =
    typeof latestPh === "number" && Number.isFinite(latestPh)
      ? formatPh(latestPh)
      : recipePh
        ? recipePh
        : "3.6";

  return {
    volumeL: adjustedTotalVolumeL,
    volumeSource: "current",
    baseVolumeL,
    secondaryVolumeL: secondaryVolume.totalVolumeL,
    adjustedTotalVolumeL,
    secondaryVolumeSource: secondaryVolume.source,
    secondaryVolumePartiallyPlanned: secondaryVolume.partiallyPlanned,
    abv: dilutedAbv,
    abvSource: hasLoggedOgFg && loggedAbv != null ? "logged_og_fg" : "recipe",
    baseAbv: initialBaseAbv,
    dilutedAbv,
    defaultPh,
    phSource:
      latestPh != null ? "latest_logged" : recipePh ? "recipe" : "default",
    stabilizerType: ctx.recipe.stabilizerPlan?.type ?? "kmeta",
    volumeUnit:
      ctx.recipe.recipeData?.unitDefaults.volume ??
      ctx.recipe.derived?.volume.unit ??
      "gal",
  };
}

export function getLoggedStabilizerAdditions(ctx: StabilizerContext) {
  return ctx.recipe.actual.additions.filter(
    (addition) =>
      addition.meta?.stabilizer === true &&
      addition.meta?.stage === "SECONDARY",
  );
}
