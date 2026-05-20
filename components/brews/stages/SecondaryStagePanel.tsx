"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import { entryPayload } from "@/lib/utils/entryPayload";
import { calculateRecipeStabilizerResults } from "@/lib/utils/calculateRecipeDerivedState";
import {
  convertAdditiveAmount,
  inferAdditiveAmountDimFromUnit,
  L_TO_VOLUME,
  nextAdditiveAmountDimOnUnitChange,
  shouldConvertAdditiveAmount,
  VOLUME_TO_L,
  WEIGHT_TO_KG,
  type UnitDim
} from "@/lib/utils/recipeDataCalculations";
import { calcABV } from "@/lib/utils/unitConverter";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import type { AdditiveLine, IngredientLine, NoteLine, RecipeUnitDefaults, VolumeUnit, WeightUnit } from "@/types/recipeData";
import type { StagePanelProps } from "../stageConfig";
import {
  AdditiveUnitSelect,
  AmountUnitField,
  convertIngredientAmount,
  getPlannedIngredientAmounts,
  IngredientBasisSelect,
  IngredientUnitSelect,
  type AdditionBasis
} from "./additionDialogShared";
import { StatusTile, WorkRow } from "./StagePanelShared";

type AdditionSource = "recipe_ingredient" | "recipe_additive" | "manual";
type AdditionKind = "INGREDIENT" | "OTHER";

type PlannedSecondaryAddition = {
  title: string;
  name: string;
  kind: AdditionKind;
  source: AdditionSource;
  amount?: number;
  unit?: string;
  weightAmount?: number;
  weightUnit?: string;
  volumeAmount?: number;
  volumeUnit?: string;
  basis?: AdditionBasis;
  recipeIngredientId?: string;
  recipeAdditiveId?: string;
  meta?: Record<string, any>;
};

type StabilizerPlan = {
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

type StabilizerDose = {
  sorbate: number;
  sulfite: number;
  campden: number;
};

type SupplementalStabilizerPlan = {
  required: StabilizerDose;
  logged: {
    sorbate: number;
    sulfite: number;
    campden: number;
  };
  additional: {
    sorbate: number;
    sulfite: number;
    campden: number;
  };
  stabilizerType: "kmeta" | "nameta";
  sulfiteForm: "powder" | "campden";
};

const SUPPLEMENTAL_GRAM_THRESHOLD = 0.01;
const SUPPLEMENTAL_CAMPDEN_THRESHOLD = 0.01;
const SUPPLEMENTAL_VOLUME_THRESHOLD_L = 0.04;

function fmtAmount(value?: string, unit?: string) {
  const v = (value ?? "").trim();
  if (!v) return null;
  return unit ? `${v} ${unit}` : v;
}

function fmtGravity(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(3);
}

function fmtNumber(value?: number | null, decimals = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

function fmtVolume(liters?: number | null, unit: RecipeUnitDefaults["volume"] = "gal") {
  if (typeof liters !== "number" || !Number.isFinite(liters) || liters <= 0) return "—";
  return `${fmtNumber(liters * L_TO_VOLUME[unit])} ${unit}`;
}

function fmtVolumeWithZero(liters?: number | null, unit: RecipeUnitDefaults["volume"] = "gal") {
  if (typeof liters !== "number" || !Number.isFinite(liters) || liters < 0) return "—";
  return `${fmtNumber(liters * L_TO_VOLUME[unit])} ${unit}`;
}

function fmtLoggedAmount(addition?: { amount: number | null; unit: string | null } | null) {
  if (!addition || typeof addition.amount !== "number") return null;
  return [fmtNumber(addition.amount), addition.unit].filter(Boolean).join(" ");
}

function latestLoggedAddition<T extends { datetime: string | null }>(items?: T[]) {
  if (!items?.length) return null;
  return [...items].sort((a, b) => {
    const aTime = a.datetime ? new Date(a.datetime).getTime() : 0;
    const bTime = b.datetime ? new Date(b.datetime).getTime() : 0;
    return bTime - aTime;
  })[0];
}

function getRecipeAmount(line: IngredientLine) {
  const src = line.amounts.basis === "volume" ? line.amounts.volume : line.amounts.weight;
  const amount = Number(src.value);
  if (!Number.isFinite(amount)) return {};
  return { amount, unit: src.unit };
}

function getAdditiveAmount(line: AdditiveLine) {
  const amount = Number(line.amount);
  if (!Number.isFinite(amount)) return {};
  return { amount, unit: line.unit };
}

function ingredientDisplay(line: IngredientLine) {
  const name = (line.name ?? "").trim() || "—";
  const weight = fmtAmount(line.amounts.weight.value, line.amounts.weight.unit);
  const volume = fmtAmount(line.amounts.volume.value, line.amounts.volume.unit);
  const primary = line.amounts.basis === "volume" ? (volume ?? weight) : (weight ?? volume);
  const secondary =
    line.amounts.basis === "volume"
      ? weight && weight !== primary
        ? weight
        : null
      : volume && volume !== primary
        ? volume
        : null;

  return { name, primary, secondary };
}

function buildSecondaryLines(lines: IngredientLine[]) {
  return lines
    .filter((line) => (line.name ?? "").trim().length > 0)
    .map((line) => ({ line, ...ingredientDisplay(line) }));
}

function buildAdditiveLines(lines: AdditiveLine[]) {
  return lines
    .filter((line) => (line.name ?? "").trim().length > 0)
    .map((line) => ({
      line,
      name: line.name.trim(),
      amount: fmtAmount(line.amount, line.unit)
    }));
}

function getNoteText(note: NoteLine) {
  return (note.content ?? [])
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");
}

function buildSecondaryNotes(notes: NoteLine[]) {
  return notes.map((note) => ({ note, text: getNoteText(note) })).filter((item) => item.text.length > 0);
}

function getEntryTime(entry: StagePanelProps["ctx"]["brew"]["entries"][number]) {
  const value = (entry as any).datetime ?? entry.createdAt;
  return typeof value === "string" ? new Date(value).getTime() : 0;
}

function latestLoggedPh(ctx: StagePanelProps["ctx"]) {
  const entry = ctx.brew.entries
    .filter((item) => item.type === BREW_ENTRY_TYPE.PH && typeof (item.data as any)?.ph === "number")
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
  "imp_fl_oz"
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

function loggedSecondaryVolumeL(line: IngredientLine, addition?: { amount: number | null; unit: string | null; meta: Record<string, any> | null } | null) {
  if (!addition || typeof addition.amount !== "number" || !Number.isFinite(addition.amount) || addition.amount <= 0) {
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
    const metaAmount = typeof addition.meta?.plannedVolumeAmount === "number" ? addition.meta.plannedVolumeAmount : null;
    if (metaUnit && metaAmount != null && Number.isFinite(metaAmount) && metaAmount > 0) return metaAmount * VOLUME_TO_L[metaUnit];
  }

  return null;
}

function toIngredientSg(line: IngredientLine) {
  const brix = parseNumber(line.brix);
  if (!Number.isFinite(brix)) return null;
  const sg = 1.00001 + 0.0038661 * brix + 1.3488 * 10 ** -5 * brix ** 2 + 4.3074 * 10 ** -8 * brix ** 3;
  return Number.isFinite(sg) && sg > 0 ? sg : null;
}

function getSecondaryVolumeBreakdown(ctx: StagePanelProps["ctx"]) {
  let loggedVolumeL = 0;
  let plannedVolumeL = 0;
  let loggedCount = 0;
  let plannedCount = 0;
  let fallbackCount = 0;

  for (const line of ctx.recipe.secondaryIngredients) {
    if (!(line.name ?? "").trim()) continue;
    const logged = latestLoggedAddition(ctx.recipe.actual.additionsByRecipeIngredientId[String(line.lineId)]);
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
    fallbackCount
  } as const;
}

function getStabilizerPlan(ctx: StagePanelProps["ctx"]): StabilizerPlan | null {
  const currentVolume = ctx.brew.current_volume_liters;
  const baseVolumeL =
    typeof currentVolume === "number" && Number.isFinite(currentVolume) && currentVolume > 0
      ? currentVolume
      : null;

  if (baseVolumeL == null) return null;

  const og = ctx.recipe.actual.originalGravity?.gravity ?? ctx.recipe.derived?.gravity.ogPrimary ?? null;
  const fg =
    ctx.recipe.actual.finalGravity?.gravity ??
    (ctx.recipe.recipeData?.fg != null ? parseNumber(String(ctx.recipe.recipeData.fg)) : null);
  const hasLoggedOgFg = Boolean(ctx.recipe.actual.originalGravity && ctx.recipe.actual.finalGravity);
  const loggedAbv =
    typeof og === "number" && Number.isFinite(og) && typeof fg === "number" && Number.isFinite(fg) ? calcABV(og, fg) : null;
  const abv = typeof loggedAbv === "number" && Number.isFinite(loggedAbv) ? loggedAbv : null;

  if (abv == null) return null;

  const secondaryVolume = getSecondaryVolumeBreakdown(ctx);
  const adjustedTotalVolumeL = baseVolumeL + secondaryVolume.totalVolumeL;
  const dilutedAbv = adjustedTotalVolumeL > 0 ? (abv * baseVolumeL) / adjustedTotalVolumeL : abv;

  const latestPh = latestLoggedPh(ctx);
  const recipePh = ctx.recipe.stabilizerPlan?.phReading?.trim();
  const defaultPh =
    typeof latestPh === "number" && Number.isFinite(latestPh)
      ? fmtNumber(latestPh, 2)
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
    baseAbv: abv,
    dilutedAbv,
    defaultPh,
    phSource: latestPh != null ? "latest_logged" : recipePh ? "recipe" : "default",
    stabilizerType: ctx.recipe.stabilizerPlan?.type ?? "kmeta",
    volumeUnit: ctx.recipe.recipeData?.unitDefaults.volume ?? ctx.recipe.derived?.volume.unit ?? "gal"
  };
}

function getLoggedStabilizerAdditions(ctx: StagePanelProps["ctx"]) {
  return ctx.recipe.actual.additions.filter(
    (addition) => addition.meta?.stabilizer === true && addition.meta?.stage === "SECONDARY"
  );
}

function getLatestLoggedStabilizer(additions: ReturnType<typeof getLoggedStabilizerAdditions>) {
  return latestLoggedAddition(additions);
}

function getSupplementalStabilizerPlan(
  ctx: StagePanelProps["ctx"],
  plan: StabilizerPlan | null
): SupplementalStabilizerPlan | null {
  if (!plan) return null;

  const additions = getLoggedStabilizerAdditions(ctx);
  if (additions.length === 0) return null;

  const latest = getLatestLoggedStabilizer(additions);
  const latestSecondaryVolumeL =
    typeof latest?.meta?.secondaryVolumeLiters === "number" && Number.isFinite(latest.meta.secondaryVolumeLiters)
      ? latest.meta.secondaryVolumeLiters
      : null;
  const latestAdjustedTotalVolumeL =
    typeof latest?.meta?.adjustedTotalVolumeLiters === "number" && Number.isFinite(latest.meta.adjustedTotalVolumeLiters)
      ? latest.meta.adjustedTotalVolumeLiters
      : null;
  const currentVolumeL =
    typeof ctx.brew.current_volume_liters === "number" &&
    Number.isFinite(ctx.brew.current_volume_liters) &&
    ctx.brew.current_volume_liters > 0
      ? ctx.brew.current_volume_liters
      : null;
  const secondaryDilutionIncreased =
    latestSecondaryVolumeL != null && plan.secondaryVolumeL > latestSecondaryVolumeL + SUPPLEMENTAL_VOLUME_THRESHOLD_L;
  const measuredVolumeOverEstimate =
    latestAdjustedTotalVolumeL != null &&
    currentVolumeL != null &&
    currentVolumeL > latestAdjustedTotalVolumeL + SUPPLEMENTAL_VOLUME_THRESHOLD_L;

  if (latestSecondaryVolumeL != null || latestAdjustedTotalVolumeL != null) {
    if (!secondaryDilutionIncreased && !measuredVolumeOverEstimate) return null;
  }

  const stabilizerType =
    latest?.meta?.stabilizerType === "nameta" || latest?.meta?.stabilizerType === "kmeta"
      ? latest.meta.stabilizerType
      : plan.stabilizerType;
  const sulfiteForm = latest?.meta?.sulfiteForm === "campden" ? "campden" : "powder";
  const ph =
    typeof latest?.meta?.ph === "number" && Number.isFinite(latest.meta.ph)
      ? String(latest.meta.ph)
      : plan.defaultPh;
  const latestBaseVolumeL =
    typeof latest?.meta?.baseVolumeLiters === "number" && Number.isFinite(latest.meta.baseVolumeLiters)
      ? latest.meta.baseVolumeLiters
      : null;
  const latestBaseAbv =
    typeof latest?.meta?.baseAbv === "number" && Number.isFinite(latest.meta.baseAbv) ? latest.meta.baseAbv : null;
  const requiredVolumeL =
    measuredVolumeOverEstimate && !secondaryDilutionIncreased && currentVolumeL != null ? currentVolumeL : plan.volumeL;
  const requiredAbv =
    measuredVolumeOverEstimate &&
    !secondaryDilutionIncreased &&
    currentVolumeL != null &&
    latestBaseVolumeL != null &&
    latestBaseAbv != null
      ? (latestBaseAbv * latestBaseVolumeL) / currentVolumeL
      : plan.abv;
  const required = calculateRecipeStabilizerResults({
    addingStabilizers: true,
    phReading: ph,
    stabilizerType,
    totalVolumeL: requiredVolumeL,
    abv: requiredAbv
  });

  const logged = additions.reduce(
    (acc, addition) => {
      const kind = addition.meta?.stabilizerKind;
      const amount = typeof addition.amount === "number" && Number.isFinite(addition.amount) ? addition.amount : 0;
      const unit = addition.unit ?? "";

      if (kind === "sorbate") {
        acc.sorbate += amount;
      } else if (kind === "sulfite") {
        if (unit === "tablets" || addition.meta?.sulfiteForm === "campden") {
          acc.campden += amount;
        } else {
          acc.sulfite += amount;
        }
      }

      return acc;
    },
    { sorbate: 0, sulfite: 0, campden: 0 }
  );

  const additional = {
    sorbate: Math.max(0, required.sorbate - logged.sorbate),
    sulfite: Math.max(0, required.sulfite - logged.sulfite),
    campden: Math.max(0, required.campden - logged.campden)
  };
  const needsSorbate = additional.sorbate > SUPPLEMENTAL_GRAM_THRESHOLD;
  const needsSulfite =
    sulfiteForm === "campden"
      ? additional.campden > SUPPLEMENTAL_CAMPDEN_THRESHOLD
      : additional.sulfite > SUPPLEMENTAL_GRAM_THRESHOLD;

  if (!needsSorbate && !needsSulfite) return null;

  return {
    required,
    logged,
    additional,
    stabilizerType,
    sulfiteForm
  };
}

export function SecondaryStagePanel({ t, status, ctx, helpers, warnings = [] }: StagePanelProps) {
  const [additionDialog, setAdditionDialog] = React.useState<PlannedSecondaryAddition | null>(null);
  const [stabilizerDialogOpen, setStabilizerDialogOpen] = React.useState(false);
  const [bulkAgeConfirmOpen, setBulkAgeConfirmOpen] = React.useState(false);
  const [packageConfirmOpen, setPackageConfirmOpen] = React.useState(false);
  const [secondaryBeforeStabilizersOpen, setSecondaryBeforeStabilizersOpen] = React.useState(false);
  const [warningsOpen, setWarningsOpen] = React.useState(true);
  const pendingSecondaryIngredientAction = React.useRef<(() => void | Promise<void>) | null>(null);

  const secondaryLines = React.useMemo(
    () => buildSecondaryLines(ctx.recipe.secondaryIngredients),
    [ctx.recipe.secondaryIngredients]
  );
  const secondaryNotes = React.useMemo(
    () => buildSecondaryNotes(ctx.recipe.secondaryNotes),
    [ctx.recipe.secondaryNotes]
  );
  const additiveLines = React.useMemo(() => buildAdditiveLines(ctx.recipe.additives), [ctx.recipe.additives]);
  const loggedIngredientIds = React.useMemo(
    () => new Set(ctx.recipe.actual.loggedRecipeIngredientIds),
    [ctx.recipe.actual.loggedRecipeIngredientIds]
  );
  const loggedAdditiveIds = React.useMemo(
    () => new Set(ctx.recipe.actual.loggedRecipeAdditiveIds),
    [ctx.recipe.actual.loggedRecipeAdditiveIds]
  );
  const loggedNoteIds = React.useMemo(
    () => new Set(ctx.recipe.actual.loggedRecipeSecondaryNoteIds),
    [ctx.recipe.actual.loggedRecipeSecondaryNoteIds]
  );

  const canEdit = status === "current";
  const missingSecondary = secondaryLines.filter((line) => !loggedIngredientIds.has(String(line.line.lineId)));
  const missingAdditives = additiveLines.filter((line) => !loggedAdditiveIds.has(String(line.line.lineId)));
  const ingredientDoneCount = secondaryLines.length - missingSecondary.length;
  const additiveDoneCount = additiveLines.length - missingAdditives.length;
  const notesDoneCount = secondaryNotes.filter((item) => loggedNoteIds.has(String(item.note.lineId))).length;
  const hasCurrentVolume =
    typeof ctx.brew.current_volume_liters === "number" &&
    Number.isFinite(ctx.brew.current_volume_liters) &&
    ctx.brew.current_volume_liters > 0;
  const readyForBulkAge = hasCurrentVolume;
  const stabilizerPlan = getStabilizerPlan(ctx);
  const usesRecipeStabilizers = Boolean(ctx.recipe.stabilizerPlan?.enabled);
  const loggedStabilizerAdditions = getLoggedStabilizerAdditions(ctx);
  const hasLoggedStabilizers = loggedStabilizerAdditions.length > 0;
  const supplementalStabilizerPlan =
    usesRecipeStabilizers && hasLoggedStabilizers ? getSupplementalStabilizerPlan(ctx, stabilizerPlan) : null;

  const logMissingSecondary = async () => {
    await helpers.addAdditions(
      missingSecondary.map((item) => {
        const { amount, unit } = getRecipeAmount(item.line);
        return {
          name: item.name,
          amount,
          unit,
          recipeIngredientId: String(item.line.lineId),
          kind: "INGREDIENT" as const,
          source: "recipe_ingredient" as const,
          meta: {
            plannedAmount: amount,
            plannedUnit: unit,
            stage: "SECONDARY"
          }
        };
      })
    );
  };

  const runSecondaryIngredientAction = (action: () => void | Promise<void>) => {
    if (usesRecipeStabilizers && !hasLoggedStabilizers) {
      pendingSecondaryIngredientAction.current = action;
      setSecondaryBeforeStabilizersOpen(true);
      return;
    }

    void action();
  };

  const logMissingAdditives = async () => {
    await helpers.addAdditions(
      missingAdditives.map((item) => {
        const { amount, unit } = getAdditiveAmount(item.line);
        return {
          name: item.name,
          amount,
          unit,
          recipeAdditiveId: String(item.line.lineId),
          kind: "OTHER" as const,
          source: "recipe_additive" as const,
          meta: {
            plannedAmount: amount,
            plannedUnit: unit,
            stage: "SECONDARY"
          }
        };
      })
    );
  };

  const logSupplementalStabilizers = async () => {
    if (!supplementalStabilizerPlan || !stabilizerPlan) return;

    const sulfiteName =
      supplementalStabilizerPlan.sulfiteForm === "campden"
        ? "Campden tablets"
        : supplementalStabilizerPlan.stabilizerType === "kmeta"
          ? "Potassium metabisulfite"
          : "Sodium metabisulfite";
    const sulfiteAmount =
      supplementalStabilizerPlan.sulfiteForm === "campden"
        ? supplementalStabilizerPlan.additional.campden
        : supplementalStabilizerPlan.additional.sulfite;
    const sulfiteUnit = supplementalStabilizerPlan.sulfiteForm === "campden" ? "tablets" : "g";
    const inputs = [
      supplementalStabilizerPlan.additional.sorbate > SUPPLEMENTAL_GRAM_THRESHOLD
        ? {
            name: "Potassium sorbate",
            amount: supplementalStabilizerPlan.additional.sorbate,
            unit: "g",
            kind: "OTHER" as const,
            source: "manual" as const,
            note: t(
              "brews.secondary.supplementalStabilizerNote",
              "Supplemental stabilizer addition after secondary dilution changed."
            ),
            meta: {
              stage: "SECONDARY",
              stabilizer: true,
              supplemental: true,
              stabilizerKind: "sorbate",
              stabilizerType: supplementalStabilizerPlan.stabilizerType,
              volumeLiters: stabilizerPlan.volumeL,
              adjustedTotalVolumeLiters: stabilizerPlan.adjustedTotalVolumeL,
              secondaryVolumeLiters: stabilizerPlan.secondaryVolumeL,
              abv: stabilizerPlan.abv,
              dilutedAbv: stabilizerPlan.dilutedAbv,
              recalculatedRequiredAmount: supplementalStabilizerPlan.required.sorbate,
              priorLoggedAmount: supplementalStabilizerPlan.logged.sorbate,
              additionalAmount: supplementalStabilizerPlan.additional.sorbate,
              calculatedUnit: "g",
              plannedAmount: supplementalStabilizerPlan.additional.sorbate,
              plannedUnit: "g"
            }
          }
        : null,
      sulfiteAmount >
      (supplementalStabilizerPlan.sulfiteForm === "campden"
        ? SUPPLEMENTAL_CAMPDEN_THRESHOLD
        : SUPPLEMENTAL_GRAM_THRESHOLD)
        ? {
            name: sulfiteName,
            amount: sulfiteAmount,
            unit: sulfiteUnit,
            kind: "OTHER" as const,
            source: "manual" as const,
            note: t(
              "brews.secondary.supplementalStabilizerNote",
              "Supplemental stabilizer addition after secondary dilution changed."
            ),
            meta: {
              stage: "SECONDARY",
              stabilizer: true,
              supplemental: true,
              stabilizerKind: "sulfite",
              sulfiteForm: supplementalStabilizerPlan.sulfiteForm,
              stabilizerType: supplementalStabilizerPlan.stabilizerType,
              volumeLiters: stabilizerPlan.volumeL,
              adjustedTotalVolumeLiters: stabilizerPlan.adjustedTotalVolumeL,
              secondaryVolumeLiters: stabilizerPlan.secondaryVolumeL,
              abv: stabilizerPlan.abv,
              dilutedAbv: stabilizerPlan.dilutedAbv,
              recalculatedRequiredAmount:
                supplementalStabilizerPlan.sulfiteForm === "campden"
                  ? supplementalStabilizerPlan.required.campden
                  : supplementalStabilizerPlan.required.sulfite,
              priorLoggedAmount:
                supplementalStabilizerPlan.sulfiteForm === "campden"
                  ? supplementalStabilizerPlan.logged.campden
                  : supplementalStabilizerPlan.logged.sulfite,
              additionalAmount: sulfiteAmount,
              calculatedUnit: sulfiteUnit,
              plannedAmount: sulfiteAmount,
              plannedUnit: sulfiteUnit,
              sulfiteAmount: supplementalStabilizerPlan.required.sulfite,
              sulfiteUnit: "g",
              campdenAmount: supplementalStabilizerPlan.required.campden,
              campdenUnit: "tablets"
            }
          }
        : null
    ].filter((input): input is NonNullable<typeof input> => Boolean(input));

    if (inputs.length > 0) await helpers.addAdditions(inputs);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatusTile
          label={t("brews.secondary.currentVolume", "Current volume")}
          value={fmtVolume(ctx.brew.current_volume_liters, stabilizerPlan?.volumeUnit)}
          tone={hasCurrentVolume ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.secondary.latestGravity", "Latest gravity")}
          value={fmtGravity(ctx.brew.latest_gravity)}
          tone="ok"
        />
        <StatusTile
          label={t("brews.secondary.additions", "Secondary additions")}
          value={`${ingredientDoneCount}/${secondaryLines.length}`}
          tone={missingSecondary.length === 0 ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brewStage.BULK_AGE", "Bulk Age")}
          value={readyForBulkAge ? t("brews.secondary.ready", "Ready") : t("brews.secondary.needsReview", "Needs review")}
          tone={readyForBulkAge ? "ok" : "warn"}
        />
      </div>

      <div className="rounded-md border border-border bg-background/40 px-3 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {readyForBulkAge
                ? t("brews.secondary.focusReady", "Ready to move into bulk aging")
                : t("brews.secondary.focusTracking", "Keep secondary additions and volume current")}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t(
                "brews.secondary.workflowHint",
                "Log additions as they happen and keep volume current before bulk aging."
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {missingSecondary.length > 1 ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={!canEdit}
                onClick={() => runSecondaryIngredientAction(logMissingSecondary)}
              >
                {t("brews.secondary.logMissingAdditions", "Log missing additions")}
              </Button>
            ) : null}
            <Button size="sm" disabled={!canEdit} onClick={() => setBulkAgeConfirmOpen(true)}>
              {t("brews.secondary.moveToBulkAge", "Move to Bulk Age")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => setPackageConfirmOpen(true)}>
              {t("brews.secondary.bottlePackage", "Bottle / Package")}
            </Button>
            {usesRecipeStabilizers && !hasLoggedStabilizers ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={!canEdit || !stabilizerPlan}
                onClick={() => setStabilizerDialogOpen(true)}
              >
                {t("brews.secondary.logStabilizers", "Log stabilizers")}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => helpers.openRecordVolume?.()}>
              {t("brews.actions.logVolume", "Record volume")}
            </Button>
          </div>
        </div>
      </div>

      {supplementalStabilizerPlan ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-3 text-sm">
          <div className="font-medium text-destructive">
            {t("brews.secondary.supplementalStabilizersTitle", "Additional stabilizers may be needed")}
          </div>
          <div className="mt-1 text-muted-foreground">
            {t(
              "brews.secondary.supplementalStabilizersHelp",
              "The logged secondary additions increased dilution after stabilizers were logged. Review the supplemental amounts before adding them."
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <InfoRow
              label={t("sorbate", "Sorbate")}
              value={`${fmtNumber(supplementalStabilizerPlan.additional.sorbate, 3)} g ${t(
                "brews.secondary.additionalNeeded",
                "additional"
              )}`}
            />
            <InfoRow
              label={
                supplementalStabilizerPlan.sulfiteForm === "campden"
                  ? t("campden", "Campden Tablets")
                  : supplementalStabilizerPlan.stabilizerType === "kmeta"
                    ? t("kMeta", "K-Meta")
                    : t("naMeta", "Na-Meta")
              }
              value={
                supplementalStabilizerPlan.sulfiteForm === "campden"
                  ? `${fmtNumber(supplementalStabilizerPlan.additional.campden, 2)} ${t("tablets", "tablets")} ${t(
                      "brews.secondary.additionalNeeded",
                      "additional"
                    )}`
                  : `${fmtNumber(supplementalStabilizerPlan.additional.sulfite, 3)} g ${t(
                      "brews.secondary.additionalNeeded",
                      "additional"
                    )}`
              }
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" disabled={!canEdit} onClick={logSupplementalStabilizers}>
              {t("brews.secondary.logSupplementalStabilizers", "Log supplemental stabilizers")}
            </Button>
          </div>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium"
            onClick={() => setWarningsOpen((open) => !open)}
          >
            <span>
              {t("brews.warnings", "Warnings")} · {warnings.length}
            </span>
            <span className="text-xs text-muted-foreground">
              {warningsOpen ? t("hide", "Hide") : t("show", "Show")}
            </span>
          </button>
          {warningsOpen ? (
            <div className="space-y-2 border-t border-yellow-500/20 px-3 py-3">
              {warnings.map((warning) => (
                <div key={warning.id} className="text-sm">
                  {warning.message(t)}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <Accordion type="multiple" defaultValue={["secondary-ingredients", "additives", "notes"]}>
        <AccordionItem value="secondary-ingredients">
          <AccordionTrigger>
            {t("brews.secondary.ingredients", "Secondary ingredients")} · {ingredientDoneCount}/{secondaryLines.length}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <Button
                size="sm"
                disabled={!canEdit || missingSecondary.length === 0}
                onClick={() => runSecondaryIngredientAction(logMissingSecondary)}
              >
                {t("brews.secondary.logMissing", "Log missing")}
              </Button>
              {secondaryLines.length ? (
                <ul className="space-y-1">
                  {secondaryLines.map((item) => {
                    const isLogged = loggedIngredientIds.has(String(item.line.lineId));
                    const loggedAddition = latestLoggedAddition(
                      ctx.recipe.actual.additionsByRecipeIngredientId[String(item.line.lineId)]
                    );
                    const { amount, unit } = getRecipeAmount(item.line);
                    return (
                      <WorkRow
                        key={item.line.lineId}
                        title={loggedAddition?.name || item.name}
                        detail={item.secondary ? `${t("brews.planned.altAmount", "Alt")}: ${item.secondary}` : null}
                        amount={fmtLoggedAmount(loggedAddition) ?? item.primary}
                        isLogged={isLogged}
                        disabled={!canEdit}
                        loggedLabel={t("brews.primary.logged", "Logged")}
                        actionLabel={t("brews.primary.log", "Log")}
                        onLog={() =>
                          runSecondaryIngredientAction(() =>
                            setAdditionDialog({
                              title: t("brews.secondary.logIngredient", "Log secondary ingredient"),
                              name: item.name,
                              kind: "INGREDIENT",
                              source: "recipe_ingredient",
                              amount,
                              unit,
                              ...getPlannedIngredientAmounts(item.line),
                              recipeIngredientId: String(item.line.lineId),
                              meta: { plannedAmount: amount, plannedUnit: unit, stage: "SECONDARY" }
                            })
                          )
                        }
                      />
                    );
                  })}
                </ul>
              ) : (
                <EmptyState>
                  {t("brews.secondary.noSecondaryIngredients", "No secondary ingredients found in the linked recipe.")}
                </EmptyState>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="additives">
          <AccordionTrigger>
            {t("brews.secondary.recipeAdditives", "Recipe additives")} · {additiveDoneCount}/{additiveLines.length}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <Button size="sm" disabled={!canEdit || missingAdditives.length === 0} onClick={logMissingAdditives}>
                {t("brews.secondary.logMissingAdditives", "Log missing additives")}
              </Button>
              {additiveLines.length ? (
                <ul className="space-y-1">
                  {additiveLines.map((item) => {
                    const isLogged = loggedAdditiveIds.has(String(item.line.lineId));
                    const loggedAddition = latestLoggedAddition(
                      ctx.recipe.actual.additionsByRecipeAdditiveId[String(item.line.lineId)]
                    );
                    const { amount, unit } = getAdditiveAmount(item.line);
                    return (
                      <WorkRow
                        key={item.line.lineId}
                        title={loggedAddition?.name || item.name}
                        amount={fmtLoggedAmount(loggedAddition) ?? item.amount}
                        isLogged={isLogged}
                        disabled={!canEdit}
                        loggedLabel={t("brews.primary.logged", "Logged")}
                        actionLabel={t("brews.primary.log", "Log")}
                        onLog={() =>
                          setAdditionDialog({
                            title: t("brews.secondary.logAdditive", "Log additive"),
                            name: item.name,
                            kind: "OTHER",
                            source: "recipe_additive",
                            amount,
                            unit,
                            recipeAdditiveId: String(item.line.lineId),
                            meta: { plannedAmount: amount, plannedUnit: unit, stage: "SECONDARY" }
                          })
                        }
                      />
                    );
                  })}
                </ul>
              ) : (
                <EmptyState>{t("brews.secondary.noRecipeAdditives", "No recipe additives found.")}</EmptyState>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="notes">
          <AccordionTrigger>
            {t("brews.secondary.recipeNotes", "Recipe secondary notes")} · {notesDoneCount}/{secondaryNotes.length}
          </AccordionTrigger>
          <AccordionContent>
            {secondaryNotes.length ? (
              <ul className="space-y-1">
                {secondaryNotes.map((item) => {
                  const isLogged = loggedNoteIds.has(String(item.note.lineId));
                  return (
                    <WorkRow
                      key={item.note.lineId}
                      title={item.text}
                      isLogged={isLogged}
                      disabled={!canEdit}
                      loggedLabel={t("brews.primary.logged", "Logged")}
                      actionLabel={t("brews.primary.addNote", "Add")}
                      onLog={async () => {
                        await helpers.addEntry(
                          entryPayload.note(item.text, "Recipe secondary note", {
                            v: 1,
                            source: "recipe_secondary_note",
                            recipeNoteId: String(item.note.lineId)
                          })
                        );
                      }}
                    />
                  );
                })}
              </ul>
            ) : (
              <EmptyState>
                {t("brews.secondary.noRecipeNotes", "No secondary notes found in the linked recipe.")}
              </EmptyState>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <LogSecondaryAdditionDialog
        planned={additionDialog}
        onOpenChange={(open) => {
          if (!open) setAdditionDialog(null);
        }}
        onSave={async (input) => {
          await helpers.addAddition(input);
          setAdditionDialog(null);
        }}
      />
      <LogStabilizersDialog
        open={stabilizerDialogOpen}
        onOpenChange={setStabilizerDialogOpen}
        plan={stabilizerPlan}
        onSave={async (inputs, extra) => {
          if (extra?.phReading != null) {
            await helpers.addEntry(
              entryPayload.ph(extra.phReading, t("brews.secondary.stabilizerPhNote", "pH reading recorded while logging stabilizers."))
            );
          }
          await helpers.addAdditions(inputs);
          setStabilizerDialogOpen(false);
        }}
      />
      <ConfirmBulkAgeDialog
        open={bulkAgeConfirmOpen}
        onOpenChange={setBulkAgeConfirmOpen}
        onConfirm={async () => {
          await helpers.moveToStage("BULK_AGE");
          setBulkAgeConfirmOpen(false);
        }}
      />
      <ConfirmPackageDialog
        open={packageConfirmOpen}
        onOpenChange={setPackageConfirmOpen}
        onConfirm={async () => {
          await helpers.moveToStage("PACKAGED");
          setPackageConfirmOpen(false);
        }}
      />
      <ConfirmSecondaryBeforeStabilizersDialog
        open={secondaryBeforeStabilizersOpen}
        onOpenChange={setSecondaryBeforeStabilizersOpen}
        onConfirm={async () => {
          const action = pendingSecondaryIngredientAction.current;
          pendingSecondaryIngredientAction.current = null;
          setSecondaryBeforeStabilizersOpen(false);
          await action?.();
        }}
      />
    </div>
  );
}

function LogSecondaryAdditionDialog({
  planned,
  onOpenChange,
  onSave
}: {
  planned: PlannedSecondaryAddition | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: {
    name: string;
    amount?: number;
    unit?: string;
    note?: string;
    recipeIngredientId?: string;
    recipeAdditiveId?: string;
    kind?: AdditionKind;
    source?: AdditionSource;
    meta?: Record<string, any>;
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [basis, setBasis] = React.useState<AdditionBasis>("other");
  const [amountTouched, setAmountTouched] = React.useState(false);
  const [amountDim, setAmountDim] = React.useState<UnitDim>("unknown");
  const [note, setNote] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!planned) return;
    setName(planned.name);
    setAmount(typeof planned.amount === "number" ? String(planned.amount) : "");
    setUnit(planned.unit ?? "");
    setBasis(planned.source === "recipe_ingredient" ? (planned.basis ?? "weight") : "other");
    setAmountTouched(false);
    setAmountDim(inferAdditiveAmountDimFromUnit(planned.unit ?? ""));
    setNote("");
  }, [planned]);

  const usesIngredientUnits = planned?.source === "recipe_ingredient";
  const usesAdditiveUnits = planned?.source === "recipe_additive";

  const changeAmount = (value: string) => {
    if (!isValidNumber(value)) return;
    setAmount(value);
    if (usesAdditiveUnits) {
      setAmountTouched(true);
      setAmountDim(inferAdditiveAmountDimFromUnit(unit));
    }
  };

  const changeBasis = (nextBasis: AdditionBasis) => {
    setBasis(nextBasis);
    if (!planned || nextBasis === "other") return;

    if (nextBasis === "weight") {
      setAmount(typeof planned.weightAmount === "number" ? String(planned.weightAmount) : "");
      setUnit(planned.weightUnit ?? "g");
      return;
    }

    setAmount(typeof planned.volumeAmount === "number" ? String(planned.volumeAmount) : "");
    setUnit(planned.volumeUnit ?? "L");
  };

  const changeUnit = (nextUnit: string) => {
    if (usesIngredientUnits) {
      setAmount(convertIngredientAmount(amount, unit, nextUnit, basis));
      setUnit(nextUnit);
      return;
    }

    if (usesAdditiveUnits) {
      const fromUnit = unit;
      const doConvert = shouldConvertAdditiveAmount({
        amountStr: amount,
        fromUnit,
        toUnit: nextUnit,
        amountTouched,
        amountDim
      });
      const nextAmount =
        doConvert && amount.trim().length > 0
          ? convertAdditiveAmount({
              amountStr: amount,
              fromUnit,
              toUnit: nextUnit
            })
          : amount;

      setAmount(nextAmount);
      setUnit(nextUnit);
      setAmountDim(
        nextAdditiveAmountDimOnUnitChange({
          fromUnit,
          toUnit: nextUnit,
          prevAmountDim: amountDim
        })
      );
      return;
    }

    setUnit(nextUnit);
  };

  const save = async () => {
    if (!planned) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const parsedAmount = amount.trim() ? Number(amount) : undefined;
    setIsSaving(true);
    try {
      await onSave({
        name: trimmedName,
        amount: typeof parsedAmount === "number" && Number.isFinite(parsedAmount) ? parsedAmount : undefined,
        unit: unit.trim() || planned.unit,
        note: note.trim() || undefined,
        recipeIngredientId: planned.recipeIngredientId,
        recipeAdditiveId: planned.recipeAdditiveId,
        kind: planned.kind,
        source: planned.source,
        meta: {
          ...(planned.meta ?? {}),
          plannedName: planned.name,
          plannedAmount: planned.amount,
          plannedUnit: planned.unit,
          actualBasis: usesIngredientUnits ? basis : undefined,
          plannedBasis: planned.basis,
          plannedWeightAmount: planned.weightAmount,
          plannedWeightUnit: planned.weightUnit,
          plannedVolumeAmount: planned.volumeAmount,
          plannedVolumeUnit: planned.volumeUnit
        }
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(planned)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{planned?.title ?? t("brews.secondary.logAddition", "Log addition")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("name", "Name")}</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t("amount", "Amount")}</Label>
            {usesIngredientUnits ? (
              <IngredientBasisSelect value={basis} onValueChange={changeBasis} t={t} />
            ) : null}
            <AmountUnitField
              amount={amount}
              unit={unit}
              onAmountChange={changeAmount}
              unitControl={
                usesIngredientUnits ? (
                  <IngredientUnitSelect
                    basis={basis}
                    value={unit}
                    onValueChange={changeUnit}
                  />
                ) : usesAdditiveUnits ? (
                  <AdditiveUnitSelect value={unit} onValueChange={changeUnit} />
                ) : undefined
              }
            />
          </div>

          <div className="space-y-2">
            <Label>{t("note", "Note")}</Label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("optional", "Optional")}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("cancel", "Cancel")}
          </Button>
          <Button onClick={save} disabled={isSaving || !name.trim()}>
            {t("save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogStabilizersDialog({
  open,
  onOpenChange,
  plan,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: StabilizerPlan | null;
  onSave: (
    inputs: Array<{
      name: string;
      amount?: number;
      unit?: string;
      note?: string;
      kind?: AdditionKind;
      source?: AdditionSource;
      meta?: Record<string, any>;
    }>,
    extra?: { phReading?: number }
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [ph, setPh] = React.useState("");
  const [takingPh, setTakingPh] = React.useState(true);
  const [stabilizerType, setStabilizerType] = React.useState<"kmeta" | "nameta">("kmeta");
  const [sulfiteForm, setSulfiteForm] = React.useState<"powder" | "campden">("powder");
  const [sorbateAmount, setSorbateAmount] = React.useState("");
  const [sulfiteActualAmount, setSulfiteActualAmount] = React.useState("");
  const [phTouched, setPhTouched] = React.useState(false);
  const [sorbateTouched, setSorbateTouched] = React.useState(false);
  const [sulfiteTouched, setSulfiteTouched] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !plan) return;
    setPh(plan.defaultPh);
    setTakingPh(true);
    setStabilizerType(plan.stabilizerType);
    setSulfiteForm("powder");
    setPhTouched(false);
    setSorbateTouched(false);
    setSulfiteTouched(false);
  }, [open, plan]);

  const parsedPh = takingPh && ph.trim() ? parseNumber(ph) : 3.6;
  const phForCalc = Number.isFinite(parsedPh) ? String(parsedPh) : "3.6";
  const phWasSkipped = !takingPh || !ph.trim();
  const results = calculateRecipeStabilizerResults({
    addingStabilizers: true,
    phReading: phForCalc,
    stabilizerType,
    totalVolumeL: plan?.volumeL ?? 0,
    abv: plan?.abv ?? 0
  });
  const sulfiteName = stabilizerType === "kmeta" ? "Potassium metabisulfite" : "Sodium metabisulfite";
  const sulfiteShortName = stabilizerType === "kmeta" ? "K-Meta" : "Na-Meta";
  const sulfiteAdditionName = sulfiteForm === "powder" ? sulfiteName : "Campden tablets";
  const sulfiteAmount = sulfiteForm === "powder" ? results.sulfite : results.campden;
  const sulfiteUnit = sulfiteForm === "powder" ? "g" : "tablets";
  const actualSorbateAmount = parseNumber(sorbateAmount);
  const actualSulfiteAmount = parseNumber(sulfiteActualAmount);
  const sorbateChanged =
    Number.isFinite(actualSorbateAmount) && Math.abs(actualSorbateAmount - results.sorbate) > 0.0005;
  const sulfiteChanged =
    Number.isFinite(actualSulfiteAmount) && Math.abs(actualSulfiteAmount - sulfiteAmount) > 0.0005;

  React.useEffect(() => {
    if (!open || !plan) return;
    if (!sorbateTouched) setSorbateAmount(fmtNumber(results.sorbate, 3));
    if (!sulfiteTouched) setSulfiteActualAmount(fmtNumber(sulfiteAmount, sulfiteForm === "powder" ? 3 : 2));
  }, [open, plan, results.sorbate, sorbateTouched, sulfiteAmount, sulfiteForm, sulfiteTouched]);

  if (!plan) return null;

  const commonMeta = {
    stage: "SECONDARY",
    stabilizer: true,
    volumeLiters: plan.volumeL,
    volumeDisplayValue: plan.volumeL * L_TO_VOLUME[plan.volumeUnit],
    volumeDisplayUnit: plan.volumeUnit,
    volumeSource: plan.volumeSource,
    abv: plan.abv,
    abvSource: plan.abvSource,
    baseVolumeLiters: plan.baseVolumeL,
    secondaryVolumeLiters: plan.secondaryVolumeL,
    adjustedTotalVolumeLiters: plan.adjustedTotalVolumeL,
    secondaryVolumeSource: plan.secondaryVolumeSource,
    secondaryVolumePartiallyPlanned: plan.secondaryVolumePartiallyPlanned,
    baseAbv: plan.baseAbv,
    dilutedAbv: plan.dilutedAbv,
    ph: Number(phForCalc),
    takingPh,
    phSource: phWasSkipped ? "default" : plan.phSource,
    phSkipped: phWasSkipped,
    stabilizerType
  };

  const save = async () => {
    setIsSaving(true);
    try {
      const phReading = Number(phForCalc);
      const defaultPhReading = parseNumber(plan.defaultPh);
      const changedLoggedPh =
        plan.phSource === "latest_logged" &&
        phTouched &&
        Number.isFinite(defaultPhReading) &&
        Math.abs(phReading - defaultPhReading) > 0.0005;
      const shouldLogPhReading =
        takingPh &&
        Number.isFinite(phReading) &&
        (plan.phSource !== "latest_logged" || changedLoggedPh);

      await onSave(
        [
          {
            name: "Potassium sorbate",
            amount: Number.isFinite(actualSorbateAmount) ? actualSorbateAmount : results.sorbate,
            unit: "g",
            kind: "OTHER",
            source: "manual",
            note: t("brews.secondary.stabilizerAdditionNote", "Stabilizer addition calculated for secondary."),
            meta: {
              ...commonMeta,
              stabilizerKind: "sorbate",
              calculatedAmount: results.sorbate,
              calculatedUnit: "g",
              actualAmountChanged: sorbateChanged,
              plannedAmount: Number.isFinite(actualSorbateAmount) ? actualSorbateAmount : results.sorbate,
              plannedUnit: "g"
            }
          },
          {
            name: sulfiteAdditionName,
            amount: Number.isFinite(actualSulfiteAmount) ? actualSulfiteAmount : sulfiteAmount,
            unit: sulfiteUnit,
            kind: "OTHER",
            source: "manual",
            note: t("brews.secondary.stabilizerAdditionNote", "Stabilizer addition calculated for secondary."),
            meta: {
              ...commonMeta,
              stabilizerKind: "sulfite",
              sulfiteForm,
              calculatedAmount: sulfiteAmount,
              calculatedUnit: sulfiteUnit,
              actualAmountChanged: sulfiteChanged,
              plannedAmount: Number.isFinite(actualSulfiteAmount) ? actualSulfiteAmount : sulfiteAmount,
              plannedUnit: sulfiteUnit,
              sulfiteAmount: results.sulfite,
              sulfiteUnit: "g",
              campdenAmount: results.campden,
              campdenUnit: "tablets"
            }
          }
        ],
        shouldLogPhReading ? { phReading: Number(phForCalc) } : undefined
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-24 bottom-24 max-h-none w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] translate-y-0 overflow-y-auto p-4 sm:max-w-[720px] sm:p-5">
        <DialogHeader>
          <DialogTitle>{t("brews.secondary.logStabilizers", "Log stabilizers")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <InfoRow
              label={t("brews.secondary.baseVolumeForStabilizers", "Base volume")}
              value={fmtVolume(plan.baseVolumeL, plan.volumeUnit)}
            />
            <InfoRow
              label={t("brews.secondary.secondaryVolumeForStabilizers", "Secondary volume")}
              value={fmtVolumeWithZero(plan.secondaryVolumeL, plan.volumeUnit)}
            />
            <InfoRow
              label={t("brews.secondary.adjustedVolumeForStabilizers", "Adjusted volume")}
              value={fmtVolume(plan.adjustedTotalVolumeL, plan.volumeUnit)}
            />
            <InfoRow label={t("brews.secondary.baseAbv", "Base ABV")} value={`${fmtNumber(plan.baseAbv)}%`} />
            <InfoRow
              label={t("brews.secondary.dilutedAbv", "Diluted ABV")}
              value={`${fmtNumber(plan.dilutedAbv)}%`}
            />
          </div>
          {plan.secondaryVolumePartiallyPlanned ? (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-muted-foreground">
              {t(
                "brews.secondary.plannedSecondaryVolumeUsed",
                "Some secondary volume is still based on planned recipe amounts. Logging actual secondary additions will refine the stabilizer calculation."
              )}
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <Label>{t("brews.secondary.takingPh", "Taking a pH reading?")}</Label>
              <Switch checked={takingPh} onCheckedChange={setTakingPh} />
            </div>
            {takingPh ? (
              <div className="space-y-2">
                <Label>{t("pH", "pH")}</Label>
                <Input
                  inputMode="decimal"
                  value={ph}
                  onChange={(event) => {
                    if (!isValidNumber(event.target.value)) return;
                    setPh(event.target.value);
                    setPhTouched(true);
                  }}
                  placeholder="3.6"
                  onFocus={(event) => event.target.select()}
                />
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("type", "Type")}</Label>
              <Select value={stabilizerType} onValueChange={(value) => setStabilizerType(value as "kmeta" | "nameta")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kmeta">{t("kMeta", "K-Meta")}</SelectItem>
                  <SelectItem value="nameta">{t("naMeta", "Na-Meta")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("brews.secondary.sulfiteForm", "Sulfite form")}</Label>
              <Select value={sulfiteForm} onValueChange={(value) => setSulfiteForm(value as "powder" | "campden")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="powder">{sulfiteShortName}</SelectItem>
                  <SelectItem value="campden">{t("campden", "Campden Tablets")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <div className="font-medium">{t("brews.secondary.calculatedStabilizers", "Calculated additions")}</div>
            <div className="mt-2 space-y-1 text-muted-foreground">
              <div>
                {t("sorbate", "Sorbate")}: {fmtNumber(results.sorbate, 3)} g
              </div>
              <div>
                {sulfiteForm === "powder" ? sulfiteShortName : t("campden", "Campden Tablets")}:{" "}
                {fmtNumber(sulfiteAmount, sulfiteForm === "powder" ? 3 : 2)} {sulfiteUnit}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border bg-background/40 px-3 py-3">
            <div className="text-sm font-medium">{t("brews.secondary.actualAmounts", "Actual amounts")}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("sorbate", "Sorbate")}</Label>
                <AmountUnitField
                  amount={sorbateAmount}
                  unit="g"
                  onAmountChange={(value) => {
                    if (!isValidNumber(value)) return;
                    setSorbateAmount(value);
                    setSorbateTouched(true);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>{sulfiteForm === "powder" ? sulfiteShortName : t("campden", "Campden Tablets")}</Label>
                <AmountUnitField
                  amount={sulfiteActualAmount}
                  unit={sulfiteUnit}
                  onAmountChange={(value) => {
                    if (!isValidNumber(value)) return;
                    setSulfiteActualAmount(value);
                    setSulfiteTouched(true);
                  }}
                />
              </div>
            </div>
            {sorbateChanged || sulfiteChanged ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t(
                  "brews.secondary.actualStabilizerWarning",
                  "Warning: actual stabilizer amounts differ from the calculated recommendation. Double-check before saving."
                )}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("cancel", "Cancel")}
          </Button>
          <Button onClick={save} disabled={isSaving}>
            {t("save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function ConfirmBulkAgeDialog({
  open,
  onOpenChange,
  onConfirm
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = React.useState(false);

  const confirm = async () => {
    setIsSaving(true);
    try {
      await onConfirm();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("brews.secondary.confirmBulkAgeTitle", "Move to bulk aging?")}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          {t("brews.secondary.confirmBulkAgeHelp", "This moves the brew out of Secondary and into the bulk age stage.")}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("cancel", "Cancel")}
          </Button>
          <Button onClick={confirm} disabled={isSaving}>
            {t("brews.secondary.moveToBulkAge", "Move to Bulk Age")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmPackageDialog({
  open,
  onOpenChange,
  onConfirm
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = React.useState(false);

  const confirm = async () => {
    setIsSaving(true);
    try {
      await onConfirm();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("brews.secondary.confirmPackageTitle", "Move to packaging?")}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          {t(
            "brews.secondary.confirmPackageHelp",
            "This skips bulk aging and moves the brew directly to the packaged stage."
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("cancel", "Cancel")}
          </Button>
          <Button onClick={confirm} disabled={isSaving}>
            {t("brews.secondary.bottlePackage", "Bottle / Package")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmSecondaryBeforeStabilizersDialog({
  open,
  onOpenChange,
  onConfirm
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = React.useState(false);

  const confirm = async () => {
    setIsSaving(true);
    try {
      await onConfirm();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("brews.secondary.secondaryBeforeStabilizersTitle", "Log additions before stabilizers?")}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          {t(
            "brews.secondary.secondaryBeforeStabilizersHelp",
            "This recipe uses stabilizers. Secondary ingredients are usually logged after stabilizers so the dosage is based on the current volume and ABV."
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("cancel", "Cancel")}
          </Button>
          <Button onClick={confirm} disabled={isSaving}>
            {t("continue", "Continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground">{children}</div>;
}
