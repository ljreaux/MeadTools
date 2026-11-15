import type { BrewResponse } from "@meadtools/api-contract";
import { loggedYeastAmountG } from "@meadtools/brew-domain";
import {
  buildBrewAddition,
  calculateGoFermFromYeastAmount,
  getNutrientRows,
  getPlannedIngredientAmounts,
  goFermKey,
  plannedAdditionMetadata,
  type NutrientComponent,
  type PlannedAddition
} from "@meadtools/brew-domain/planned-additions";
import { calculateRecipeStabilizerResults } from "@meadtools/core/derived";
import { L_TO_VOLUME } from "@meadtools/core/recipe";
import { getLoggedStabilizerAdditions, getStabilizerPlan } from "@meadtools/brew-domain/stabilizer-plan";
import { buildBrewRecipeStageData } from "@meadtools/brew-domain/recipe-stage";

import type { BrewEntryOutboxRecord } from "@/outbox/entry-outbox-record";

type Translate = (key: string, fallback: string) => string;
export type PlannedRow = PlannedAddition & {
  id: string;
  status: "available" | "logged" | "queued";
  group: "PRIMARY" | "SECONDARY";
  components?: NutrientComponent[];
};

export function plannedAdditionRows(
  brew: BrewResponse,
  queued: readonly BrewEntryOutboxRecord[],
  nutrientLabel: (index: number) => string
) {
  const serverIds = new Set(brew.entries.map((entry) => entry.id));
  const pending = queued.filter((row) => !serverIds.has(row.clientEntryId));
  const entries = [
    ...brew.entries,
    ...pending.filter((row) => row.delivery.status !== "terminal_failure").map(({ request }) => ({
      id: request.client_entry_id,
      datetime: request.datetime,
      type: request.type,
      title: request.title ?? null,
      note: request.note ?? null,
      gravity: request.gravity ?? null,
      data: request.data
    }))
  ];
  const recipe = buildBrewRecipeStageData({
    recipeSnapshot: brew.recipe_snapshot,
    currentVolumeLiters: brew.current_volume_liters,
    latestGravity: brew.latest_gravity,
    entries
  });
  const { planned, actual } = recipe;
  const rows: PlannedRow[] = [];
  const status = (entryId?: string) =>
    !entryId ? "available" : serverIds.has(entryId) ? "logged" : "queued";

  for (const line of planned.ingredients) {
    if (!line.name?.trim()) continue;
    const amounts = getPlannedIngredientAmounts(line);
    const selected = line.amounts[amounts.basis];
    const group = line.secondary ? "SECONDARY" : "PRIMARY";
    rows.push({
      ...amounts, id: `ingredient:${line.lineId}`, group, name: line.name, kind: "INGREDIENT",
      source: "recipe_ingredient", recipeIngredientId: String(line.lineId),
      amount: Number(selected.value), unit: selected.unit,
      status: status(actual.additionsByRecipeIngredientId[String(line.lineId)]?.[0]?.entryId),
      meta: {
        catalogReference: group === "PRIMARY" && line.ref?.kind === "catalog"
          ? { catalog: "ingredient", id: String(line.ref.ingredientId) }
          : undefined
      }
    });
  }
  for (const line of planned.additives) {
    if (!line.name?.trim()) continue;
    rows.push({
      id: `additive:${line.lineId}`, group: "SECONDARY", name: line.name, kind: "OTHER",
      source: "recipe_additive", recipeAdditiveId: String(line.lineId),
      amount: Number(line.amount), unit: line.unit,
      status: status(actual.additionsByRecipeAdditiveId[String(line.lineId)]?.[0]?.entryId)
    });
  }

  const stabilizerContext = { brew: { ...brew, entries }, recipe: { ...recipe, ...planned } };
  const stabilizers = planned.stabilizerPlan?.enabled
    ? getStabilizerPlan(stabilizerContext, (ph) => ph.toFixed(2))
    : null;
  if (stabilizers) {
    const parsedPh = Number(stabilizers.defaultPh.replace(",", "."));
    const ph = Number.isFinite(parsedPh) ? parsedPh : 3.6;
    const doses = calculateRecipeStabilizerResults({
      addingStabilizers: true, phReading: String(ph), stabilizerType: stabilizers.stabilizerType,
      totalVolumeL: stabilizers.volumeL, abv: stabilizers.abv
    });
    const logged = getLoggedStabilizerAdditions(stabilizerContext);
    for (const kind of ["sorbate", "sulfite"] as const) {
      const name = kind === "sorbate" ? "Potassium sorbate"
        : stabilizers.stabilizerType === "kmeta" ? "Potassium metabisulfite" : "Sodium metabisulfite";
      rows.push({
        id: `stabilizer:${kind}`, group: "SECONDARY", name, source: "manual", kind: "OTHER",
        amount: doses[kind], unit: "g", status: status(logged.find((entry) => entry.meta?.stabilizerKind === kind)?.entryId),
        meta: {
          stage: "SECONDARY", stabilizer: true, stabilizerKind: kind,
          volumeLiters: stabilizers.volumeL, volumeDisplayValue: stabilizers.volumeL * L_TO_VOLUME[stabilizers.volumeUnit],
          volumeDisplayUnit: stabilizers.volumeUnit, volumeSource: stabilizers.volumeSource,
          abv: stabilizers.abv, abvSource: stabilizers.abvSource, baseVolumeLiters: stabilizers.baseVolumeL,
          secondaryVolumeLiters: stabilizers.secondaryVolumeL, adjustedTotalVolumeLiters: stabilizers.adjustedTotalVolumeL,
          secondaryVolumeSource: stabilizers.secondaryVolumeSource,
          secondaryVolumePartiallyPlanned: stabilizers.secondaryVolumePartiallyPlanned,
          baseAbv: stabilizers.baseAbv, dilutedAbv: stabilizers.dilutedAbv,
          ph, takingPh: true, phSource: stabilizers.phSource, phSkipped: false, stabilizerType: stabilizers.stabilizerType,
          calculatedAmount: doses[kind], calculatedUnit: "g", plannedUnit: "g",
          ...(kind === "sulfite" ? {
            sulfiteForm: "powder", sulfiteAmount: doses.sulfite, sulfiteUnit: "g",
            campdenAmount: doses.campden, campdenUnit: "tablets"
          } : {})
        }
      });
    }
  }

  const yeast = planned.yeast;
  const yeastName = [yeast?.brand, yeast?.strain].filter(Boolean).join(" ");
  rows.push({
    id: "yeast", group: "PRIMARY", name: actual.yeastAddition?.name ?? yeastName,
    kind: "YEAST", source: yeast ? "recipe_yeast" : "manual_yeast",
    amount: yeast?.plannedAmountG ?? undefined, unit: "g",
    status: status(actual.yeastAddition?.entryId),
    meta: {
      yeastId: yeast?.yeastId ?? null, brand: yeast?.brand ?? null, strain: yeast?.strain,
      nitrogenRequirement: yeast?.nitrogenRequirement, plannedName: yeastName || undefined,
      plannedAmount: yeast?.plannedAmountG, plannedUnit: yeast ? "g" : undefined,
      plannedYeastId: yeast?.yeastId, plannedBrand: yeast?.brand, plannedStrain: yeast?.strain
    }
  });

  const goFerm = planned.nutrientPlan?.derived.goFerm;
  const goFermType = actual.goFermAddition?.name
    ?? planned.nutrientPlan?.effectiveData.inputs.goFermType ?? "none";
  const yeastAmount = loggedYeastAmountG(actual.yeastAddition);
  if (goFerm && goFermType !== "none" && (goFerm.amount > 0 || actual.goFermAddition)) {
    const fromPitch = calculateGoFermFromYeastAmount(goFermType, yeastAmount);
    rows.push({
      id: "go-ferm", group: "PRIMARY", name: goFermType, kind: "NUTRIENT", source: "recipe_go_ferm",
      amount: fromPitch?.amount ?? goFerm.amount, unit: "g", status: status(actual.goFermAddition?.entryId),
      meta: {
        goFerm: true, goFermUsed: true, nutrientKey: goFermKey(goFermType),
        actualYeastAmount: yeastAmount, actualYeastUnit: yeastAmount != null ? "g" : undefined,
        plannedWaterAmount: fromPitch?.water ?? goFerm.water,
        recipePlannedAmount: goFerm.amount,
        recipePlannedWaterAmount: goFerm.water, plannedWaterUnit: "mL"
      }
    });
  }

  const loggedNutrients = actual.additions.filter((addition) => addition.source === "recipe_nutrient");
  for (const row of getNutrientRows({ nutrientPlan: planned.nutrientPlan, actual })) {
    const amount = row.components.reduce((sum, component) => sum + component.amount, 0);
    const logged = loggedNutrients.find((addition) => addition.meta?.nutrientAdditionIndex === row.index)
      ?? loggedNutrients.filter((addition) => addition.meta?.nutrientAdditionIndex == null)[
        row.index - 1 - loggedNutrients.filter((addition) => Number(addition.meta?.nutrientAdditionIndex) < row.index).length
      ];
    rows.push({
      id: `nutrient:${row.index}`, group: "PRIMARY", name: nutrientLabel(row.index),
      kind: "NUTRIENT", source: "recipe_nutrient", amount, unit: "g", components: row.components,
      status: status(logged?.entryId),
      meta: { nutrientAdditionIndex: row.index, plannedTotalAmount: amount }
    });
  }

  return { rows, remaining: actual.remainingNutrientGrams, hasNutrientPlan: Boolean(planned.nutrientPlan) };
}

export function buildPlannedAddition(
  row: PlannedRow,
  actual: {
    amount?: number;
    name: string;
    unit?: string;
    note: string;
    components?: NutrientComponent[];
    datetime: string;
    stage?: string;
    skipGoFerm?: boolean;
  },
  translate: Translate
) {
  const skipGoFerm = row.source === "recipe_go_ferm" && actual.skipGoFerm;
  if (skipGoFerm) {
    return { ...buildBrewAddition({
      name: row.name,
      amount: 0,
      unit: "g",
      note: translate("brews.primary.goFermNotUsed", "Go-Ferm not used."),
      datetime: actual.datetime,
      kind: "NUTRIENT",
      source: "recipe_go_ferm",
      meta: {
        goFerm: true,
        nutrientKey: goFermKey(row.name),
        goFermUsed: false,
        plannedAmount: row.meta?.recipePlannedAmount ?? row.amount,
        plannedUnit: "g",
        plannedWaterAmount: row.meta?.recipePlannedWaterAmount,
        plannedWaterUnit: "mL"
      }
    }, translate), datetime: actual.datetime };
  }
  const yeast = row.kind === "YEAST";
  const stabilizer = row.meta?.stabilizer === true;
  const { recipePlannedAmount: _recipePlannedAmount, ...plannedMeta } = row.meta ?? {};
  const meta = stabilizer
    ? { ...row.meta, plannedAmount: actual.amount ?? row.amount,
        actualAmountChanged: actual.amount != null && Math.abs(actual.amount - Number(row.amount?.toFixed(2))) > 0.0005 }
    : yeast ? { ...row.meta, strain: row.source === "manual_yeast" ? actual.name : row.meta?.strain }
    : plannedAdditionMetadata({ ...row, meta: plannedMeta }, {
        name: row.name, basis: row.basis, components: actual.components, stage: actual.stage,
        water: typeof row.meta?.plannedWaterAmount === "number" ? row.meta.plannedWaterAmount : undefined
      });
  return { ...buildBrewAddition({
    name: actual.name, amount: actual.amount, unit: actual.unit ?? row.unit,
    note: actual.note.trim() || (stabilizer ? translate("brews.secondary.stabilizerAdditionNote", "Stabilizer addition calculated for secondary.") : undefined), datetime: actual.datetime,
    kind: row.kind, source: row.source, recipeIngredientId: row.recipeIngredientId,
    recipeAdditiveId: row.recipeAdditiveId, meta
  }, translate), datetime: actual.datetime };
}
