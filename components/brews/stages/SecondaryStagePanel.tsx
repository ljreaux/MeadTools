"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  BREW_TRACKER_DIALOG_CONTENT_CLASS,
  BREW_TRACKER_DIALOG_FOOTER_CLASS,
  BREW_TRACKER_WIDE_DIALOG_CONTENT_CLASS
} from "@/components/brews/brewTrackerDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import { entryPayload } from "@/lib/utils/entryPayload";
import { calculateRecipeStabilizerResults } from "@/lib/utils/calculateRecipeDerivedState";
import {
  L_TO_VOLUME,
  VOLUME_TO_L,
  WEIGHT_TO_KG
} from "@/lib/utils/recipeDataCalculations";
import {
  roundEditableAmount,
  scaleAdditiveSuggestions,
  scaleSecondaryIngredientSuggestions,
  type ScaledAdditiveSuggestion,
  type ScaledIngredientSuggestion
} from "@/lib/utils/brewTrackingScaling";
import { calcABV } from "@/lib/utils/unitConverter";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import type { IngredientLine, RecipeUnitDefaults, VolumeUnit, WeightUnit } from "@/types/recipeData";
import type { StagePanelProps } from "../stageConfig";
import {
  AmountUnitField,
  getBrewItemLabel,
  getPlannedIngredientAmounts,
  PlannedAdditionDialog,
  type PlannedAdditionDialogItem
} from "./additionDialogShared";
import {
  buildAdditiveLines,
  buildIngredientLines,
  buildNoteLines,
  formatGravity,
  formatLoggedAmount,
  formatNumber,
  formatVolume,
  getAdditiveAmount,
  getIngredientAmount,
  latestLoggedItem,
  LogRecipeNoteDialog,
  StatusTile,
  WarningsPanel,
  WorkRow
} from "./StagePanelShared";

type AdditionSource = "recipe_ingredient" | "recipe_additive" | "manual";
type AdditionKind = "INGREDIENT" | "OTHER";

type PlannedSecondaryAddition = PlannedAdditionDialogItem;

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

function fmtVolumeWithZero(liters?: number | null, unit: RecipeUnitDefaults["volume"] = "gal", locale?: string) {
  return formatVolume(liters, unit, locale, { allowZero: true });
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
    const logged = latestLoggedItem(ctx.recipe.actual.additionsByRecipeIngredientId[String(line.lineId)]);
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

function getStabilizerPlan(ctx: StagePanelProps["ctx"], locale?: string): StabilizerPlan | null {
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
      ? formatNumber(latestPh, 2, locale)
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
  return latestLoggedItem(additions);
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
  const { i18n } = useTranslation();
  const [additionDialog, setAdditionDialog] = React.useState<PlannedSecondaryAddition | null>(null);
  const [stabilizerDialogOpen, setStabilizerDialogOpen] = React.useState(false);
  const [bulkAgeConfirmOpen, setBulkAgeConfirmOpen] = React.useState(false);
  const [packageConfirmOpen, setPackageConfirmOpen] = React.useState(false);
  const [secondaryBeforeStabilizersOpen, setSecondaryBeforeStabilizersOpen] = React.useState(false);
  const [recipeNoteDialog, setRecipeNoteDialog] = React.useState<{
    text: string;
    recipeNoteId: string;
  } | null>(null);
  const [scaledSecondarySuggestions, setScaledSecondarySuggestions] = React.useState<
    Map<string, ScaledIngredientSuggestion>
  >(new Map());
  const [scaledAdditiveSuggestions, setScaledAdditiveSuggestions] = React.useState<
    Map<string, ScaledAdditiveSuggestion>
  >(new Map());
  const [loggingMissingSecondary, setLoggingMissingSecondary] = React.useState(false);
  const [loggingMissingAdditives, setLoggingMissingAdditives] = React.useState(false);
  const [loggingSupplementalStabilizers, setLoggingSupplementalStabilizers] = React.useState(false);
  const pendingSecondaryIngredientAction = React.useRef<(() => void | Promise<void>) | null>(null);

  const secondaryLines = React.useMemo(
    () => buildIngredientLines(ctx.recipe.secondaryIngredients),
    [ctx.recipe.secondaryIngredients]
  );
  const secondaryNotes = React.useMemo(
    () => buildNoteLines(ctx.recipe.secondaryNotes),
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
  const recipeBaseVolumeL =
    typeof ctx.recipe.derived?.volume.totalL === "number" && Number.isFinite(ctx.recipe.derived.volume.totalL)
      ? ctx.recipe.derived.volume.totalL
      : null;
  const locale = i18n.resolvedLanguage;
  const fmtNumber = (value?: number | null, decimals = 2) => formatNumber(value, decimals, locale);
  const fmtGravity = (value?: number | null) => formatGravity(value, locale);
  const fmtVolume = (value?: number | null, unit: RecipeUnitDefaults["volume"] = "gal") =>
    formatVolume(value, unit, locale);
  const fmtLoggedAmount = (addition?: { amount: number | null; unit: string | null } | null) =>
    formatLoggedAmount(addition, locale);
  const missingSecondary = secondaryLines.filter((line) => !loggedIngredientIds.has(String(line.line.lineId)));
  const missingAdditives = additiveLines.filter((line) => !loggedAdditiveIds.has(String(line.line.lineId)));
  const ingredientDoneCount = secondaryLines.length - missingSecondary.length;
  const additiveDoneCount = additiveLines.length - missingAdditives.length;
  const notesDoneCount = secondaryNotes.filter((item) => loggedNoteIds.has(String(item.note.lineId))).length;
  const hasCurrentVolume =
    typeof ctx.brew.current_volume_liters === "number" &&
    Number.isFinite(ctx.brew.current_volume_liters) &&
    ctx.brew.current_volume_liters > 0;
  const canScaleSuggestions = canEdit && hasCurrentVolume && recipeBaseVolumeL != null && recipeBaseVolumeL > 0;
  const readyForBulkAge = hasCurrentVolume;
  const stabilizerPlan = getStabilizerPlan(ctx, locale);
  const usesRecipeStabilizers = Boolean(ctx.recipe.stabilizerPlan?.enabled);
  const loggedStabilizerAdditions = getLoggedStabilizerAdditions(ctx);
  const hasLoggedStabilizers = loggedStabilizerAdditions.length > 0;
  const supplementalStabilizerPlan =
    usesRecipeStabilizers && hasLoggedStabilizers ? getSupplementalStabilizerPlan(ctx, stabilizerPlan) : null;

  const getScaledIngredientSuggestion = (lineId: string) => scaledSecondarySuggestions.get(String(lineId));
  const getScaledAdditiveSuggestion = (lineId: string) => scaledAdditiveSuggestions.get(String(lineId));

  const getSecondaryIngredientAmount = (line: IngredientLine) => {
    const scaled = getScaledIngredientSuggestion(line.lineId);
    if (scaled) return { amount: scaled.basisAmount, unit: scaled.basisUnit };
    return getIngredientAmount(line);
  };

  const getSecondaryIngredientPlannedAmounts = (line: IngredientLine) => {
    const planned = getPlannedIngredientAmounts(line);
    const scaled = getScaledIngredientSuggestion(line.lineId);
    if (!scaled) return planned;

    return {
      basis: planned.basis,
      weightAmount: scaled.weightAmount,
      weightUnit: scaled.weightUnit,
      volumeAmount: scaled.volumeAmount,
      volumeUnit: scaled.volumeUnit
    };
  };

  const getSecondaryIngredientDisplay = (item: (typeof secondaryLines)[number]) => {
    const scaled = getScaledIngredientSuggestion(item.line.lineId);
    if (!scaled) {
      return {
        amount: item.primary,
        detail: item.secondary ? `${t("brews.planned.altAmount", "Alt")}: ${item.secondary}` : null
      };
    }

    const alternate =
      item.line.amounts.basis === "volume"
        ? `${fmtNumber(scaled.weightAmount)} ${scaled.weightUnit}`
        : `${fmtNumber(scaled.volumeAmount)} ${scaled.volumeUnit}`;

    return {
      amount: `${fmtNumber(scaled.basisAmount)} ${scaled.basisUnit}`,
      detail: `${t("brews.planned.altAmount", "Alt")}: ${alternate}`
    };
  };

  const getSecondaryAdditiveAmount = (lineId: string, fallback: ReturnType<typeof getAdditiveAmount>) => {
    const scaled = getScaledAdditiveSuggestion(lineId);
    if (scaled) return { amount: scaled.amount, unit: scaled.unit };
    return fallback;
  };

  const getSecondaryAdditiveDisplay = (item: (typeof additiveLines)[number]) => {
    const scaled = getScaledAdditiveSuggestion(item.line.lineId);
    return scaled ? `${fmtNumber(scaled.amount)} ${scaled.unit}` : item.amount;
  };

  const scaleSecondaryToCurrentVolume = () => {
    setScaledSecondarySuggestions(
      scaleSecondaryIngredientSuggestions({
        lines: ctx.recipe.secondaryIngredients,
        loggedIds: loggedIngredientIds,
        currentVolumeL: ctx.brew.current_volume_liters,
        recipeBaseVolumeL
      })
    );
  };

  const scaleAdditivesToCurrentVolume = () => {
    setScaledAdditiveSuggestions(
      scaleAdditiveSuggestions({
        lines: ctx.recipe.additives,
        loggedIds: loggedAdditiveIds,
        currentVolumeL: ctx.brew.current_volume_liters,
        recipeBaseVolumeL
      })
    );
  };

  const logMissingSecondary = async () => {
    if (loggingMissingSecondary) return;
    setLoggingMissingSecondary(true);
    try {
      await helpers.addAdditions(
        missingSecondary.map((item) => {
          const { amount, unit } = getSecondaryIngredientAmount(item.line);
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
              ...getSecondaryIngredientPlannedAmounts(item.line),
              stage: "SECONDARY"
            }
          };
        })
      );
    } finally {
      setLoggingMissingSecondary(false);
    }
  };

  const runSecondaryIngredientAction = (action: () => void | Promise<void>) => {
    if (loggingMissingSecondary) return;
    if (usesRecipeStabilizers && !hasLoggedStabilizers) {
      pendingSecondaryIngredientAction.current = action;
      setSecondaryBeforeStabilizersOpen(true);
      return;
    }

    void action();
  };

  const logMissingAdditives = async () => {
    if (loggingMissingAdditives) return;
    setLoggingMissingAdditives(true);
    try {
      await helpers.addAdditions(
        missingAdditives.map((item) => {
          const { amount, unit } = getSecondaryAdditiveAmount(item.line.lineId, getAdditiveAmount(item.line));
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
    } finally {
      setLoggingMissingAdditives(false);
    }
  };

  const logSupplementalStabilizers = async () => {
    if (!supplementalStabilizerPlan || !stabilizerPlan) return;
    if (loggingSupplementalStabilizers) return;
    setLoggingSupplementalStabilizers(true);

    try {
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
    } finally {
      setLoggingSupplementalStabilizers(false);
    }
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
                disabled={!canEdit || loggingMissingSecondary}
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
            <Button size="sm" variant="secondary" disabled={!canScaleSuggestions} onClick={scaleSecondaryToCurrentVolume}>
              {t("brews.secondary.scaleSecondaryIngredients", "Scale secondary ingredients")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canScaleSuggestions} onClick={scaleAdditivesToCurrentVolume}>
              {t("brews.secondary.scaleAdditives", "Scale additives")}
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
            <Button
              size="sm"
              variant="destructive"
              disabled={!canEdit || loggingSupplementalStabilizers}
              onClick={logSupplementalStabilizers}
            >
              {t("brews.secondary.logSupplementalStabilizers", "Log supplemental stabilizers")}
            </Button>
          </div>
        </div>
      ) : null}

      <WarningsPanel warnings={warnings} defaultOpen />

      <Accordion type="multiple" defaultValue={["secondary-ingredients", "additives", "notes"]}>
        <AccordionItem value="secondary-ingredients">
          <AccordionTrigger>
            {t("brews.secondary.ingredients", "Secondary ingredients")} · {ingredientDoneCount}/{secondaryLines.length}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <Button
                size="sm"
                disabled={!canEdit || missingSecondary.length === 0 || loggingMissingSecondary}
                onClick={() => runSecondaryIngredientAction(logMissingSecondary)}
              >
                {t("brews.secondary.logMissing", "Log missing")}
              </Button>
              {secondaryLines.length ? (
                <ul className="space-y-1">
                  {secondaryLines.map((item) => {
                    const isLogged = loggedIngredientIds.has(String(item.line.lineId));
                    const loggedAddition = latestLoggedItem(
                      ctx.recipe.actual.additionsByRecipeIngredientId[String(item.line.lineId)]
                    );
                    const { amount, unit } = getSecondaryIngredientAmount(item.line);
                    const display = getSecondaryIngredientDisplay(item);
                    return (
                      <WorkRow
                        key={item.line.lineId}
                        title={getBrewItemLabel(t, loggedAddition?.name || item.name)}
                        detail={display.detail}
                        amount={fmtLoggedAmount(loggedAddition) ?? display.amount}
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
                              ...getSecondaryIngredientPlannedAmounts(item.line),
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
              <Button
                size="sm"
                disabled={!canEdit || missingAdditives.length === 0 || loggingMissingAdditives}
                onClick={logMissingAdditives}
              >
                {t("brews.secondary.logMissingAdditives", "Log missing additives")}
              </Button>
              {additiveLines.length ? (
                <ul className="space-y-1">
                  {additiveLines.map((item) => {
                    const isLogged = loggedAdditiveIds.has(String(item.line.lineId));
                    const loggedAddition = latestLoggedItem(
                      ctx.recipe.actual.additionsByRecipeAdditiveId[String(item.line.lineId)]
                    );
                    const { amount, unit } = getSecondaryAdditiveAmount(item.line.lineId, getAdditiveAmount(item.line));
                    return (
                      <WorkRow
                        key={item.line.lineId}
                        title={getBrewItemLabel(t, loggedAddition?.name || item.name)}
                        amount={fmtLoggedAmount(loggedAddition) ?? getSecondaryAdditiveDisplay(item)}
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
                      onLog={() => {
                        setRecipeNoteDialog({
                          text: item.text,
                          recipeNoteId: String(item.note.lineId)
                        });
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

      <PlannedAdditionDialog
        planned={additionDialog}
        onOpenChange={(open) => {
          if (!open) setAdditionDialog(null);
        }}
        onSave={async (input) => {
          await helpers.addAddition(input);
          setAdditionDialog(null);
        }}
        defaultTitle={t("brews.secondary.logAddition", "Log addition")}
      />
      <LogStabilizersDialog
        open={stabilizerDialogOpen}
        onOpenChange={setStabilizerDialogOpen}
        plan={stabilizerPlan}
        onSave={async (inputs, extra) => {
          if (extra?.phReading != null) {
            await helpers.addEntry(
              entryPayload.ph(
                extra.phReading,
                t("brews.secondary.stabilizerPhNote", "pH reading recorded while logging stabilizers."),
                extra.datetime
              )
            );
          }
          await helpers.addAdditions(inputs);
          setStabilizerDialogOpen(false);
        }}
      />
      <ConfirmBulkAgeDialog
        open={bulkAgeConfirmOpen}
        onOpenChange={setBulkAgeConfirmOpen}
        onConfirm={async (datetime) => {
          await helpers.moveToStage("BULK_AGE", datetime);
          setBulkAgeConfirmOpen(false);
        }}
      />
      <ConfirmPackageDialog
        open={packageConfirmOpen}
        onOpenChange={setPackageConfirmOpen}
        onConfirm={async (datetime) => {
          await helpers.moveToStage("PACKAGED", datetime);
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
      <LogRecipeNoteDialog
        note={
          recipeNoteDialog
            ? {
                title: t("brews.secondary.recipeNoteTitle", "Add recipe secondary note"),
                text: recipeNoteDialog.text
              }
            : null
        }
        onOpenChange={(open) => {
          if (!open) setRecipeNoteDialog(null);
        }}
        onSave={async (datetime) => {
          if (!recipeNoteDialog) return;
          await helpers.addEntry(
            entryPayload.note(
              recipeNoteDialog.text,
              "Recipe secondary note",
              {
                source: "recipe_secondary_note",
                recipeNoteId: recipeNoteDialog.recipeNoteId
              },
              datetime
            )
          );
          setRecipeNoteDialog(null);
        }}
      />
    </div>
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
      datetime?: string;
    }>,
    extra?: { phReading?: number; datetime?: string }
  ) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage;
  const fmtNumber = (value?: number | null, decimals = 2) => formatNumber(value, decimals, locale);
  const fmtVolume = (value?: number | null, unit: RecipeUnitDefaults["volume"] = "gal") =>
    formatVolume(value, unit, locale);
  const fmtVolumeWithLocale = (value?: number | null, unit: RecipeUnitDefaults["volume"] = "gal") =>
    fmtVolumeWithZero(value, unit, locale);
  const [ph, setPh] = React.useState("");
  const [takingPh, setTakingPh] = React.useState(true);
  const [stabilizerType, setStabilizerType] = React.useState<"kmeta" | "nameta">("kmeta");
  const [sulfiteForm, setSulfiteForm] = React.useState<"powder" | "campden">("powder");
  const [sorbateAmount, setSorbateAmount] = React.useState("");
  const [sulfiteActualAmount, setSulfiteActualAmount] = React.useState("");
  const [phTouched, setPhTouched] = React.useState(false);
  const [sorbateTouched, setSorbateTouched] = React.useState(false);
  const [sulfiteTouched, setSulfiteTouched] = React.useState(false);
  const [datetime, setDatetime] = React.useState<Date>(new Date());
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
    setDatetime(new Date());
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
  const editableSorbateAmount = roundEditableAmount(results.sorbate);
  const editableSulfiteAmount = roundEditableAmount(sulfiteAmount);
  const actualSorbateAmount = parseNumber(sorbateAmount);
  const actualSulfiteAmount = parseNumber(sulfiteActualAmount);
  const sorbateChanged =
    Number.isFinite(actualSorbateAmount) && Math.abs(actualSorbateAmount - editableSorbateAmount) > 0.0005;
  const sulfiteChanged =
    Number.isFinite(actualSulfiteAmount) && Math.abs(actualSulfiteAmount - editableSulfiteAmount) > 0.0005;

  React.useEffect(() => {
    if (!open || !plan) return;
    if (!sorbateTouched) setSorbateAmount(fmtNumber(editableSorbateAmount, 2));
    if (!sulfiteTouched) setSulfiteActualAmount(fmtNumber(editableSulfiteAmount, 2));
  }, [open, plan, editableSorbateAmount, sorbateTouched, editableSulfiteAmount, sulfiteForm, sulfiteTouched]);

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
            datetime: datetime.toISOString(),
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
            datetime: datetime.toISOString(),
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
        shouldLogPhReading ? { phReading: Number(phForCalc), datetime: datetime.toISOString() } : undefined
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={BREW_TRACKER_WIDE_DIALOG_CONTENT_CLASS}>
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
              value={fmtVolumeWithLocale(plan.secondaryVolumeL, plan.volumeUnit)}
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

          <div className="space-y-2">
            <Label>{t("date", "Date")}</Label>
            <DateTimePicker value={datetime} onChange={(value) => value && setDatetime(value)} hourCycle={12} />
          </div>
        </div>

        <DialogFooter className={BREW_TRACKER_DIALOG_FOOTER_CLASS}>
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
  onConfirm: (datetime: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = React.useState(false);
  const [datetime, setDatetime] = React.useState<Date>(new Date());

  React.useEffect(() => {
    if (open) setDatetime(new Date());
  }, [open]);

  const confirm = async () => {
    setIsSaving(true);
    try {
      await onConfirm(datetime.toISOString());
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${BREW_TRACKER_DIALOG_CONTENT_CLASS} sm:max-w-[480px]`}>
        <DialogHeader>
          <DialogTitle>{t("brews.secondary.confirmBulkAgeTitle", "Move to bulk aging?")}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          {t("brews.secondary.confirmBulkAgeHelp", "This moves the brew out of Secondary and into the bulk age stage.")}
        </div>
        <div className="space-y-2">
          <Label>{t("date", "Date")}</Label>
          <DateTimePicker value={datetime} onChange={(value) => value && setDatetime(value)} hourCycle={12} />
        </div>
        <DialogFooter className={BREW_TRACKER_DIALOG_FOOTER_CLASS}>
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
  onConfirm: (datetime: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = React.useState(false);
  const [datetime, setDatetime] = React.useState<Date>(new Date());

  React.useEffect(() => {
    if (open) setDatetime(new Date());
  }, [open]);

  const confirm = async () => {
    setIsSaving(true);
    try {
      await onConfirm(datetime.toISOString());
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${BREW_TRACKER_DIALOG_CONTENT_CLASS} sm:max-w-[480px]`}>
        <DialogHeader>
          <DialogTitle>{t("brews.secondary.confirmPackageTitle", "Move to packaging?")}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          {t(
            "brews.secondary.confirmPackageHelp",
            "This skips bulk aging and moves the brew directly to the packaged stage."
          )}
        </div>
        <div className="space-y-2">
          <Label>{t("date", "Date")}</Label>
          <DateTimePicker value={datetime} onChange={(value) => value && setDatetime(value)} hourCycle={12} />
        </div>
        <DialogFooter className={BREW_TRACKER_DIALOG_FOOTER_CLASS}>
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
      <DialogContent className={`${BREW_TRACKER_DIALOG_CONTENT_CLASS} sm:max-w-[480px]`}>
        <DialogHeader>
          <DialogTitle>{t("brews.secondary.secondaryBeforeStabilizersTitle", "Log additions before stabilizers?")}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          {t(
            "brews.secondary.secondaryBeforeStabilizersHelp",
            "This recipe uses stabilizers. Secondary ingredients are usually logged after stabilizers so the dosage is based on the current volume and ABV."
          )}
        </div>
        <DialogFooter className={BREW_TRACKER_DIALOG_FOOTER_CLASS}>
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
