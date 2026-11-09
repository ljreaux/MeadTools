import lodash from "lodash";
import type { NutrientKey } from "@meadtools/core/nutrients";
import { entryPayload } from "./entry-payload";
import type { IngredientLine } from "./recipe-snapshot";
import type { BrewRecipeStageData } from "./recipe-stage";

type AdditionBasis = "weight" | "volume" | "other";
type AdditionInput = Parameters<typeof entryPayload.addition>[0];

export type PlannedAddition = AdditionInput & {
  basis?: AdditionBasis;
  weightAmount?: number;
  weightUnit?: string;
  volumeAmount?: number;
  volumeUnit?: string;
};

export type NutrientComponent = {
  key: string;
  name: string;
  amount: number;
  unit: string;
  plannedAmount: number;
};

export function getBrewItemKey(name?: string | null) {
  const value = (name ?? "").trim();
  if (!value) return null;

  const normalized = value.toLowerCase();
  const explicitKeys: Record<string, string> = {
    "campden tablets": "campden",
    dap: "nutrients.dap",
    "fermaid k": "nutrients.fermK",
    "fermaid o": "nutrients.fermO",
    "go-ferm": "nuteResults.gfTypes.gf",
    "go-ferm protect": "nuteResults.gfTypes.gfProtect",
    "go-ferm sterol flash": "nuteResults.gfTypes.gfSterol",
    "k-meta": "kMeta",
    "na-meta": "naMeta",
    none: "none",
    other: "other.label",
    "potassium metabisulfite": "kMeta",
    "potassium sorbate": "kSorbate",
    protect: "nuteResults.gfTypes.gfProtect",
    "sodium metabisulfite": "naMeta",
    sorbate: "sorbate",
    "sterol-flash": "nuteResults.gfTypes.gfSterol",
  };

  return explicitKeys[normalized] ?? lodash.camelCase(value);
}

export function getPlannedIngredientAmounts(line: IngredientLine) {
  const weightAmount = Number(line.amounts.weight.value);
  const volumeAmount = Number(line.amounts.volume.value);

  return {
    basis: line.amounts.basis,
    weightAmount: Number.isFinite(weightAmount) ? weightAmount : undefined,
    weightUnit: line.amounts.weight.unit,
    volumeAmount: Number.isFinite(volumeAmount) ? volumeAmount : undefined,
    volumeUnit: line.amounts.volume.unit,
  };
}

export function calculateGoFermFromYeastAmount(
  type: string,
  yeastAmountG?: number | null
) {
  if (
    typeof yeastAmountG !== "number" ||
    !Number.isFinite(yeastAmountG) ||
    yeastAmountG <= 0
  ) {
    return null;
  }

  const multiplier = type === "sterol-flash" ? 1.2 : 1.25;
  const waterMultiplier = type === "sterol-flash" ? 10 : 20;
  const amount = Math.round(yeastAmountG * multiplier * 100) / 100;

  return {
    amount,
    water: Math.round(amount * waterMultiplier * 100) / 100
  };
}

const nutrientLabels: Record<NutrientKey, string> = {
  fermO: "Fermaid O",
  fermK: "Fermaid K",
  dap: "DAP",
  other: "Other"
};

export function getNutrientRows(recipe: { nutrientPlan: BrewRecipeStageData["planned"]["nutrientPlan"]; actual: BrewRecipeStageData["actual"] }) {
  const plan = recipe.nutrientPlan;
  if (!plan) return [];

  const keys: NutrientKey[] = ["fermO", "fermK", "dap", "other"];
  const selected = plan.effectiveData.selected.selectedNutrients;
  const per = plan.derived.nutrientAdditions.perAddition;
  const totals = plan.derived.nutrientAdditions.totalGrams;
  const otherName = plan.effectiveData.settings.other.name.trim();
  const loggedCount = recipe.actual.loggedNutrientAdditionCount ?? 0;
  const plannedCount = Math.max(
    0,
    Math.floor(plan.derived.numberOfAdditions || 0)
  );
  const hasComponentLogs = keys.some(
    (key) => (recipe.actual.loggedNutrientGrams[key] ?? 0) > 0
  );
  const remaining = keys.reduce<Record<NutrientKey, number>>(
    (acc, key) => {
      const logged = hasComponentLogs
        ? (recipe.actual.loggedNutrientGrams[key] ?? 0)
        : Math.min(loggedCount, plannedCount) * (per[key] ?? 0);
      acc[key] = Math.max(0, (totals[key] ?? 0) - logged);
      return acc;
    },
    { fermO: 0, fermK: 0, dap: 0, other: 0 }
  );
  const hasRemaining = keys.some((key) => remaining[key] > 0.01);
  const suggestedRowsRemaining = Math.max(
    plannedCount - loggedCount,
    hasRemaining ? 1 : 0
  );
  const targetCount = Math.max(
    plannedCount,
    loggedCount + (hasRemaining ? 1 : 0)
  );

  const buildComponents = (divisor: number, useRemaining: boolean) =>
    keys
      .filter((key) => selected[key])
      .map((key) => {
        const amountSource = useRemaining
          ? remaining[key] / Math.max(1, divisor)
          : per[key];
        const amount = Number.isFinite(amountSource) ? amountSource : 0;
        return {
          key,
          name: key === "other" && otherName ? otherName : nutrientLabels[key],
          amount,
          unit: "g",
          plannedAmount: amount
        };
      })
      .filter((component) => component.amount > 0);

  return Array.from({ length: targetCount }, (_, index) => {
    const rowIndex = index + 1;
    const useRemaining = rowIndex > loggedCount;
    return {
      index: rowIndex,
      isExtra: rowIndex > plannedCount,
      components: buildComponents(suggestedRowsRemaining, useRemaining)
    };
  }).filter((row) => row.components.length > 0);
}

export function plannedAdditionMetadata(planned: PlannedAddition, actual: {
  name: string;
  basis?: AdditionBasis;
  water?: number;
  components?: NutrientComponent[];
  stage?: string;
}) {
  const goFerm = planned.source === "recipe_go_ferm";
  return {
    ...planned.meta,
    nutrientKey: goFerm ? goFermKey(actual.name) : planned.meta?.nutrientKey,
    nameKey: planned.meta?.nameKey ?? getBrewItemKey(planned.name) ?? undefined,
    plannedName: planned.name,
    plannedAmount: planned.amount,
    plannedUnit: planned.unit,
    actualBasis: actual.basis,
    plannedBasis: planned.basis,
    plannedWeightAmount: planned.weightAmount,
    plannedWeightUnit: planned.weightUnit,
    plannedVolumeAmount: planned.volumeAmount,
    plannedVolumeUnit: planned.volumeUnit,
    actualWaterAmount: actual.water,
    actualWaterUnit: goFerm ? "mL" : undefined,
    components: actual.components,
    stage: actual.stage
  };
}

export function goFermKey(name: string) {
  if (name === "protect") return "goFermProtect";
  if (name === "sterol-flash") return "goFermSterolFlash";
  return "goFerm";
}

export function buildBrewAddition(
  input: AdditionInput,
  translate: (key: string, fallback: string) => string
) {
  const nameKey = typeof input.meta?.nameKey === "string"
    ? input.meta.nameKey
    : getBrewItemKey(String(input.meta?.plannedName ?? input.name));
  const name = input.name.trim();
  const fallbackKey = getBrewItemKey(name);
  const fallback = fallbackKey ? translate(fallbackKey, name) : name;
  return entryPayload.addition({
    ...input,
    name: nameKey ? translate(nameKey, fallback) : fallback,
    amount: input.amount == null ? undefined : Number(input.amount.toFixed(6)),
    meta: { ...input.meta, nameKey: nameKey ?? undefined, plannedName: input.meta?.plannedName ?? input.name }
  });
}
