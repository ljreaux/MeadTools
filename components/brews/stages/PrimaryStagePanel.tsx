"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import type { AdditiveLine, IngredientLine, NoteLine } from "@/types/recipeData";
import type { NutrientKey } from "@/types/nutrientData";
import type { StagePanelProps } from "../stageConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import { entryPayload } from "@/lib/utils/entryPayload";
import { parseNumber, isValidNumber } from "@/lib/utils/validateInput";
import { LogYeastDialog } from "@/components/brews/LogYeastDialog";
import { StatusTile, WorkRow } from "./StagePanelShared";
import {
  convertAdditiveAmount,
  inferAdditiveAmountDimFromUnit,
  nextAdditiveAmountDimOnUnitChange,
  shouldConvertAdditiveAmount,
  type UnitDim
} from "@/lib/utils/recipeDataCalculations";
import {
  AdditiveUnitSelect,
  AmountUnitField,
  convertIngredientAmount,
  getPlannedIngredientAmounts,
  IngredientBasisSelect,
  IngredientUnitSelect,
  type AdditionBasis
} from "./additionDialogShared";

type AdditionSource =
  | "recipe_ingredient"
  | "recipe_additive"
  | "recipe_nutrient"
  | "recipe_go_ferm"
  | "recipe_yeast"
  | "manual_yeast"
  | "manual";

type AdditionKind = "INGREDIENT" | "NUTRIENT" | "YEAST" | "OTHER";
const goFermOptions = [
  { value: "Go-Ferm", label: "nuteResults.gfTypes.gf" },
  { value: "protect", label: "nuteResults.gfTypes.gfProtect" },
  { value: "sterol-flash", label: "nuteResults.gfTypes.gfSterol" }
] as const;

function calculateGoFermFromYeastAmount(type: string, yeastAmountG?: number | null) {
  if (typeof yeastAmountG !== "number" || !Number.isFinite(yeastAmountG) || yeastAmountG <= 0) {
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

type PlannedAddition = {
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
  components?: Array<{
    key: string;
    name: string;
    amount: number;
    unit: string;
    plannedAmount: number;
  }>;
};

const nutrientLabels: Record<NutrientKey, string> = {
  fermO: "Fermaid O",
  fermK: "Fermaid K",
  dap: "DAP",
  other: "Other"
};

function fmtAmount(value?: string, unit?: string) {
  const v = (value ?? "").trim();
  if (!v) return null;
  return unit ? `${v} ${unit}` : v;
}

function fmtGravity(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(3);
}

function fmtVolume(liters?: number | null) {
  if (typeof liters !== "number" || !Number.isFinite(liters) || liters <= 0) {
    return "—";
  }
  return `${(liters / 3.78541).toFixed(2)} gal`;
}

function fmtNumber(value?: number | null, decimals = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

function fmtLoggedAmount(
  addition?: {
    amount: number | null;
    unit: string | null;
  } | null
) {
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

function buildPrimaryLines(lines: IngredientLine[]) {
  return lines
    .filter((line) => !line.secondary)
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

function buildPrimaryNotes(notes: NoteLine[]) {
  return notes.map((note) => ({ note, text: getNoteText(note) })).filter((item) => item.text.length > 0);
}

function getEstimatedFg(ctx: StagePanelProps["ctx"]) {
  const value = parseNumber(ctx.recipe.recipeData?.fg ?? "");
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getNutrientRows(ctx: StagePanelProps["ctx"]) {
  const plan = ctx.recipe.nutrientPlan;
  if (!plan) return [];

  const keys: NutrientKey[] = ["fermO", "fermK", "dap", "other"];
  const selected = plan.effectiveData.selected.selectedNutrients;
  const per = plan.derived.nutrientAdditions.perAddition;
  const otherName = plan.effectiveData.settings.other.name.trim();

  const components = keys
    .filter((key) => selected[key])
    .map((key) => {
      const amount = Number.isFinite(per[key]) ? per[key] : 0;
      return {
        key,
        name: key === "other" && otherName ? otherName : nutrientLabels[key],
        amount,
        unit: "g",
        plannedAmount: amount
      };
    })
    .filter((component) => component.amount > 0);

  const count = Math.max(0, Math.floor(plan.derived.numberOfAdditions || 0));
  return Array.from({ length: count }, (_, index) => ({
    index: index + 1,
    components
  })).filter((row) => row.components.length > 0);
}

export function PrimaryStagePanel({
  t,
  status,
  ctx,
  helpers,
  warnings = []
}: StagePanelProps) {
  const [additionDialog, setAdditionDialog] = React.useState<PlannedAddition | null>(null);
  const [yeastDialogMode, setYeastDialogMode] = React.useState<"planned" | "manual" | null>(null);
  const [warningsOpen, setWarningsOpen] = React.useState(true);
  const primaryLines = React.useMemo(
    () => buildPrimaryLines(ctx.recipe.primaryIngredients),
    [ctx.recipe.primaryIngredients]
  );
  const additiveLines = React.useMemo(() => buildAdditiveLines(ctx.recipe.additives), [ctx.recipe.additives]);
  const primaryNotes = React.useMemo(() => buildPrimaryNotes(ctx.recipe.primaryNotes), [ctx.recipe.primaryNotes]);
  const nutrientRows = React.useMemo(() => getNutrientRows(ctx), [ctx]);

  const loggedIngredientIds = React.useMemo(
    () => new Set(ctx.recipe.actual.loggedRecipeIngredientIds),
    [ctx.recipe.actual.loggedRecipeIngredientIds]
  );
  const loggedAdditiveIds = React.useMemo(
    () => new Set(ctx.recipe.actual.loggedRecipeAdditiveIds),
    [ctx.recipe.actual.loggedRecipeAdditiveIds]
  );
  const loggedNoteIds = React.useMemo(
    () => new Set(ctx.recipe.actual.loggedRecipePrimaryNoteIds),
    [ctx.recipe.actual.loggedRecipePrimaryNoteIds]
  );
  const loggedNutrientIndexes = React.useMemo(
    () => new Set(ctx.recipe.actual.loggedNutrientAdditionIndexes),
    [ctx.recipe.actual.loggedNutrientAdditionIndexes]
  );

  const missingIngredients = React.useMemo(
    () => primaryLines.filter((line) => !loggedIngredientIds.has(String(line.line.lineId))),
    [primaryLines, loggedIngredientIds]
  );

  const canEdit = status === "current";
  const recipeOg = ctx.recipe.derived?.gravity.ogPrimary ?? null;
  const suggestedOg = ctx.recipe.actual.suggestedOriginalGravity ?? recipeOg;
  const nutrientBasis = ctx.recipe.actual.nutrientBasis;
  const hasNutrientBasis = Boolean(nutrientBasis);
  const ogDiffersFromSuggestion = Boolean(
    nutrientBasis &&
      typeof suggestedOg === "number" &&
      Number.isFinite(suggestedOg) &&
      Math.abs(nutrientBasis.basis.chosenOg - suggestedOg) > 0.0005
  );
  const estimatedFg = getEstimatedFg(ctx);
  const finalGravity = ctx.recipe.actual.finalGravity?.gravity ?? null;
  const fgDelta = typeof finalGravity === "number" && estimatedFg != null ? Math.abs(finalGravity - estimatedFg) : null;
  const fgOutsideEstimate = typeof fgDelta === "number" && fgDelta > 0.005;
  const ingredientDoneCount = primaryLines.length - missingIngredients.length;
  const additiveDoneCount = additiveLines.filter((line) => loggedAdditiveIds.has(String(line.line.lineId))).length;
  const notesDoneCount = primaryNotes.filter((item) => loggedNoteIds.has(String(item.note.lineId))).length;
  const nutrientDoneCount = nutrientRows.filter((row) => loggedNutrientIndexes.has(row.index)).length;
  const goFerm = ctx.recipe.nutrientPlan?.derived.goFerm;
  const hasPlannedGoFerm = typeof goFerm?.amount === "number" && Number.isFinite(goFerm.amount) && goFerm.amount > 0;
  const hasLoggedGoFerm = Boolean(ctx.recipe.actual.goFermAddition);
  const hasLoggedOg = Boolean(ctx.recipe.actual.originalGravity);
  const hasLoggedYeast = Boolean(ctx.recipe.actual.yeastAddition);
  const hasLoggedFg = Boolean(ctx.recipe.actual.finalGravity);
  const hasLoggedSecondaryVolume =
    typeof ctx.brew.current_volume_liters === "number" &&
    Number.isFinite(ctx.brew.current_volume_liters) &&
    ctx.brew.current_volume_liters > 0;
  const nutrientDisabledReason = !hasNutrientBasis
    ? t("brews.primary.nutrientsNeedOg", "Log OG first.")
    : !hasLoggedYeast
      ? t("brews.primary.nutrientsNeedYeast", "Log yeast before nutrient additions.")
      : hasPlannedGoFerm && !hasLoggedGoFerm
        ? t("brews.primary.nutrientsNeedGoFermDecision", "Log Go-Ferm or mark it not used before nutrient additions.")
        : null;
  const actualYeastAmountG = ctx.recipe.actual.yeastAddition?.amount;
  const yeastRowTitle =
    ctx.recipe.actual.yeastAddition?.name ||
    [ctx.recipe.yeast?.brand, ctx.recipe.yeast?.strain].filter(Boolean).join(" ");
  const yeastRowAmount =
    typeof ctx.recipe.actual.yeastAddition?.amount === "number"
      ? `${fmtNumber(ctx.recipe.actual.yeastAddition.amount)} ${ctx.recipe.actual.yeastAddition.unit || "g"}`
      : typeof ctx.recipe.yeast?.plannedAmountG === "number"
        ? `${fmtNumber(ctx.recipe.yeast.plannedAmountG)} g`
        : null;
  const plannedGoFermType = ctx.recipe.nutrientPlan?.effectiveData.inputs.goFermType || "Go-Ferm";
  const actualYeastGoFerm = calculateGoFermFromYeastAmount(plannedGoFermType, actualYeastAmountG);
  const defaultGoFermAmount = actualYeastGoFerm?.amount ?? goFerm?.amount;
  const defaultGoFermWater = actualYeastGoFerm?.water ?? goFerm?.water;
  const loggedGoFerm = ctx.recipe.actual.goFermAddition;
  const loggedGoFermUsed = loggedGoFerm?.meta?.goFermUsed !== false;
  const loggedGoFermWater =
    typeof loggedGoFerm?.meta?.actualWaterAmount === "number"
      ? loggedGoFerm.meta.actualWaterAmount
      : typeof loggedGoFerm?.meta?.plannedWaterAmount === "number"
        ? loggedGoFerm.meta.plannedWaterAmount
        : null;
  const goFermRowTitle = loggedGoFerm?.name || t("brews.primary.goFerm", "Go-Ferm");
  const goFermRowAmount =
    loggedGoFerm && !loggedGoFermUsed
      ? "0 g"
      : typeof loggedGoFerm?.amount === "number"
        ? `${fmtNumber(loggedGoFerm.amount)} ${loggedGoFerm.unit || "g"}`
        : `${fmtNumber(ctx.recipe.nutrientPlan?.derived.goFerm.amount)} g`;
  const goFermRowDetail =
    loggedGoFerm && !loggedGoFermUsed
      ? t("brews.primary.goFermNotUsed", "Go-Ferm not used.")
      : typeof loggedGoFermWater === "number"
        ? `${fmtNumber(loggedGoFermWater, 0)} mL ${t("water", "water")}`
        : `${fmtNumber(ctx.recipe.nutrientPlan?.derived.goFerm.water, 0)} mL ${t("water", "water")}`;
  const logGoFerm = () =>
    setAdditionDialog({
      title: t("brews.primary.logGoFerm", "Log Go-Ferm"),
      name: plannedGoFermType,
      kind: "NUTRIENT",
      source: "recipe_go_ferm",
      amount: defaultGoFermAmount,
      unit: "g",
      meta: {
        goFerm: true,
        goFermUsed: true,
        actualYeastAmount: actualYeastAmountG,
        actualYeastUnit: actualYeastAmountG != null ? "g" : undefined,
        plannedAmount: goFerm?.amount,
        plannedUnit: "g",
        plannedWaterAmount: defaultGoFermWater,
        recipePlannedWaterAmount: goFerm?.water,
        plannedWaterUnit: "mL"
      }
    });
  const nextNutrientRow = nutrientRows.find((row) => !loggedNutrientIndexes.has(row.index));
  const openNutrientRow = (row: (typeof nutrientRows)[number]) => {
    const total = row.components.reduce((sum, item) => sum + item.amount, 0);
    setAdditionDialog({
      title: t("brews.primary.logNutrients", "Log nutrients"),
      name: t("brews.primary.nutrientAddition", "Nutrient addition {{index}}", {
        index: row.index
      }),
      kind: "NUTRIENT",
      source: "recipe_nutrient",
      amount: total,
      unit: "g",
      components: row.components,
      meta: {
        nutrientAdditionIndex: row.index,
        plannedTotalAmount: total,
        plannedUnit: "g"
      }
    });
  };
  const markGoFermNotUsed = async () => {
    await helpers.addAddition({
      name: ctx.recipe.nutrientPlan?.effectiveData.inputs.goFermType || "Go-Ferm",
      kind: "NUTRIENT",
      source: "recipe_go_ferm",
      amount: 0,
      unit: "g",
      note: t("brews.primary.goFermNotUsed", "Go-Ferm not used."),
      meta: {
        goFerm: true,
        goFermUsed: false,
        plannedAmount: goFerm?.amount,
        plannedUnit: "g",
        plannedWaterAmount: goFerm?.water,
        plannedWaterUnit: "mL"
      }
    });
  };
  const logMissingIngredients = async () => {
    await helpers.addAdditions(
      missingIngredients.map((item) => {
        const { amount, unit } = getRecipeAmount(item.line);
        return {
          name: item.name,
          amount,
          unit,
          recipeIngredientId: String(item.line.lineId),
          source: "recipe_ingredient" as const,
          meta: { plannedAmount: amount, plannedUnit: unit }
        };
      })
    );
  };
  const pitchPending = !hasNutrientBasis || !hasLoggedYeast || (hasPlannedGoFerm && !hasLoggedGoFerm);
  const nutrientsPending = !pitchPending && nutrientDoneCount < nutrientRows.length;
  const fgPending = !pitchPending && !nutrientsPending && !hasLoggedFg;
  const transferPending = !pitchPending && !nutrientsPending && !fgPending && !hasLoggedSecondaryVolume;
  const workflowFocus = pitchPending
    ? t("brews.primary.focusPitch", "Pitch yeast and record starting details")
    : nutrientsPending
      ? t("brews.primary.focusNutrients", "Keep up with nutrient additions")
      : fgPending
        ? t("brews.primary.focusFg", "Take final gravity when fermentation is finished")
        : transferPending
          ? t("brews.primary.focusTransfer", "Transfer to secondary and record the new volume")
          : t("brews.primary.focusReady", "Ready to move to secondary");

  const openReading = () => {
    helpers.openAddEntry?.({
      allowedTypes: [BREW_ENTRY_TYPE.GRAVITY, BREW_ENTRY_TYPE.TEMPERATURE, BREW_ENTRY_TYPE.PH]
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatusTile
          label={t("brews.primary.og", "Original gravity")}
          value={
            ctx.recipe.actual.originalGravity
              ? fmtGravity(ctx.recipe.actual.originalGravity.gravity)
              : typeof suggestedOg === "number" && Number.isFinite(suggestedOg) && suggestedOg > 1
                ? t("brews.primary.suggestedOgAvailable", "Suggested OG available")
                : "—"
          }
          tone={ctx.recipe.actual.originalGravity && !ogDiffersFromSuggestion ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.primary.fg", "Final gravity")}
          value={fmtGravity(finalGravity)}
          tone={ctx.recipe.actual.finalGravity ? (fgOutsideEstimate ? "warn" : "ok") : "warn"}
        />
        <StatusTile
          label={t("brews.primary.currentVolume", "Current volume")}
          value={fmtVolume(ctx.brew.current_volume_liters)}
          tone={ctx.brew.current_volume_liters ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.primary.yeast", "Yeast")}
          value={ctx.recipe.actual.yeastAddition?.name ?? "—"}
          tone={ctx.recipe.actual.yeastAddition ? "ok" : "warn"}
        />
      </div>

      <div className="rounded-md border border-border bg-background/40 px-3 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium">{workflowFocus}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t(
                "brews.primary.workflowHint",
                "Use the sections below for planned items; keep notes and readings available any time."
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {missingIngredients.length > 0 ? (
              <Button size="sm" variant="secondary" disabled={!canEdit} onClick={logMissingIngredients}>
                {t("brews.primary.logMissingIngredients", "Log missing ingredients")}
              </Button>
            ) : null}
            {pitchPending && !hasNutrientBasis ? (
              <Button size="sm" disabled={!canEdit} onClick={() => helpers.openOriginalGravityDialog?.()}>
                {t("brews.actions.logOg", "Log OG")}
              </Button>
            ) : null}
            {pitchPending && !hasLoggedYeast ? (
              <Button
                size="sm"
                disabled={!canEdit}
                onClick={() => setYeastDialogMode(ctx.recipe.yeast ? "planned" : "manual")}
              >
                {t("brews.actions.logYeast", "Log yeast")}
              </Button>
            ) : null}
            {pitchPending && hasPlannedGoFerm && !hasLoggedGoFerm ? (
              <Button size="sm" disabled={!canEdit} onClick={logGoFerm}>
                {t("brews.actions.logGoFerm", "Log Go-Ferm")}
              </Button>
            ) : null}
            {nutrientsPending && nextNutrientRow ? (
              <Button
                size="sm"
                disabled={!canEdit || Boolean(nutrientDisabledReason)}
                onClick={() => openNutrientRow(nextNutrientRow)}
              >
                {t("brews.primary.logNextNutrient", "Log next nutrient")}
              </Button>
            ) : null}
            {fgPending ? (
              <Button size="sm" onClick={() => helpers.openFinalGravityDialog?.()} disabled={!canEdit}>
                {t("brews.actions.logFg", "Log FG")}
              </Button>
            ) : null}
            {transferPending ? (
              <Button size="sm" onClick={() => helpers.openRecordVolume?.()} disabled={!canEdit}>
                {t("brews.actions.logSecondaryVolume", "Record secondary volume")}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              disabled={!canEdit}
              onClick={() => helpers.openStageMoveReview?.("SECONDARY")}
            >
              {t("brews.moveToSecondary", "Move to Secondary")}
            </Button>
            {hasLoggedOg ? (
              <Button size="sm" variant="secondary" disabled={!canEdit} onClick={openReading}>
                {t("brews.actions.logReading", "Log reading")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

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

      {fgOutsideEstimate ? (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
          {t(
            "brews.warn.finalGravityEstimateMismatchWithValues",
            "Final gravity is not close to the recipe’s estimated FG."
          )}{" "}
          {t("brews.primary.estimatedFg", "Estimated FG")}: {fmtGravity(estimatedFg)},{" "}
          {t("brews.primary.loggedFg", "Logged FG")}: {fmtGravity(finalGravity)}.
        </div>
      ) : null}

      {ogDiffersFromSuggestion && nutrientBasis ? (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
          {t("brews.primary.ogDiffersFromSuggestion", "Logged OG differs from the suggested OG used for planning.")}{" "}
          {t("brews.primary.suggestedOg", "Suggested OG")}: {fmtGravity(suggestedOg)},{" "}
          {t("brews.primary.loggedOg", "Logged OG")}: {fmtGravity(nutrientBasis.basis.chosenOg)}.
        </div>
      ) : null}

      <Accordion type="multiple" defaultValue={["yeast", "ingredients"]}>
        <AccordionItem value="yeast">
          <AccordionTrigger>
            {t("brews.primary.yeast", "Yeast")} ·{" "}
            {ctx.recipe.actual.yeastAddition
              ? t("brews.primary.logged", "Logged")
              : t("brews.primary.required", "Required")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {ctx.recipe.yeast || ctx.recipe.actual.yeastAddition ? (
                <WorkRow
                  title={yeastRowTitle || t("brews.primary.yeast", "Yeast")}
                  amount={yeastRowAmount}
                  isLogged={Boolean(ctx.recipe.actual.yeastAddition)}
                  disabled={!canEdit}
                  onLog={() => setYeastDialogMode("planned")}
                  loggedLabel={t("brews.primary.logged", "Logged")}
                  actionLabel={t("brews.primary.log", "Log")}
                />
              ) : null}

              {ctx.recipe.nutrientPlan?.derived.goFerm.amount ? (
                <div className="space-y-2">
                  <WorkRow
                    title={goFermRowTitle}
                    detail={goFermRowDetail}
                    amount={goFermRowAmount}
                    isLogged={hasLoggedGoFerm}
                    disabled={!canEdit}
                    onLog={logGoFerm}
                    loggedLabel={t("brews.primary.logged", "Logged")}
                    actionLabel={t("brews.primary.log", "Log")}
                  />
                  {!hasLoggedGoFerm ? (
                    <Button size="sm" variant="secondary" disabled={!canEdit} onClick={markGoFermNotUsed}>
                      {t("brews.primary.markGoFermNotUsed", "Mark not used")}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {!hasLoggedYeast ? (
                <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => setYeastDialogMode("manual")}>
                  {ctx.recipe.yeast
                    ? t("brews.primary.logDifferentYeast", "Log different yeast")
                    : t("brews.actions.logYeast", "Log yeast")}
                </Button>
              ) : null}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ingredients">
          <AccordionTrigger>
            {t("brews.primary.ingredients", "Primary ingredients")} · {ingredientDoneCount}/{primaryLines.length}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <Button size="sm" disabled={!canEdit || missingIngredients.length === 0} onClick={logMissingIngredients}>
                {t("brews.primary.logMissing", "Log missing")}
              </Button>
              {primaryLines.length ? (
                <ul className="space-y-1">
                  {primaryLines.map((item) => {
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
                          setAdditionDialog({
                            title: t("brews.primary.logIngredient", "Log ingredient"),
                            name: item.name,
                            kind: "INGREDIENT",
                            source: "recipe_ingredient",
                            amount,
                            unit,
                            ...getPlannedIngredientAmounts(item.line),
                            recipeIngredientId: String(item.line.lineId),
                            meta: { plannedAmount: amount, plannedUnit: unit }
                          })
                        }
                      />
                    );
                  })}
                </ul>
              ) : (
                <EmptyState>
                  {t("brews.primary.noPrimaryIngredients", "No primary ingredients found in the linked recipe.")}
                </EmptyState>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="additives">
          <AccordionTrigger>
            {t("brews.primary.additives", "Planned additives")} · {additiveDoneCount}/{additiveLines.length}
          </AccordionTrigger>
          <AccordionContent>
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
                          title: t("brews.primary.logAdditive", "Log additive"),
                          name: item.name,
                          kind: "OTHER",
                          source: "recipe_additive",
                          amount,
                          unit,
                          recipeAdditiveId: String(item.line.lineId),
                          meta: { plannedAmount: amount, plannedUnit: unit }
                        })
                      }
                    />
                  );
                })}
              </ul>
            ) : (
              <EmptyState>
                {t("brews.primary.noAdditives", "No planned additives found in the linked recipe.")}
              </EmptyState>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="nutrients">
          <AccordionTrigger>
            {t("brews.primary.nutrients", "Nutrients")} · {nutrientDoneCount}/{nutrientRows.length}
          </AccordionTrigger>
          <AccordionContent>
            {nutrientRows.length ? (
              <div className="space-y-2">
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {t(
                    "brews.primary.nutrientsRecipeBuilderNotice",
                    "This schedule uses logged OG, linked primary additions, yeast, and Go-Ferm. Change the schedule settings in the recipe builder for now."
                  )}
                </div>
                {hasNutrientBasis && ctx.recipe.actual.missingActualPrimaryIngredientIds.length > 0 ? (
                  <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-muted-foreground">
                    {t(
                      "brews.primary.nutrientsUsingPlannedIngredients",
                      "Some linked primary ingredients have not been logged yet, so their planned amounts are being used for nutrient recalculation."
                    )}
                  </div>
                ) : null}
                <ul className="space-y-1">
                  {nutrientRows.map((row) => {
                    const isLogged = loggedNutrientIndexes.has(row.index);
                    const total = row.components.reduce((sum, item) => sum + item.amount, 0);
                    return (
                      <WorkRow
                        key={row.index}
                        title={t("brews.primary.nutrientAddition", "Nutrient addition {{index}}", {
                          index: row.index
                        })}
                        detail={row.components
                          .map((item) => `${item.name}: ${fmtNumber(item.amount)} ${item.unit}`)
                          .join(", ")}
                        amount={`${fmtNumber(total)} g`}
                        isLogged={isLogged}
                        disabled={!canEdit || Boolean(nutrientDisabledReason)}
                        disabledReason={nutrientDisabledReason}
                        loggedLabel={t("brews.primary.logged", "Logged")}
                        actionLabel={t("brews.primary.log", "Log")}
                        onLog={() => openNutrientRow(row)}
                      />
                    );
                  })}
                </ul>
              </div>
            ) : (
              <EmptyState>{t("brews.primary.noNutrients", "No planned nutrient additions found.")}</EmptyState>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="notes">
          <AccordionTrigger>
            {t("brews.primary.recipeNotes", "Recipe primary notes")} · {notesDoneCount}/{primaryNotes.length}
          </AccordionTrigger>
          <AccordionContent>
            {primaryNotes.length ? (
              <ul className="space-y-1">
                {primaryNotes.map((item) => {
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
                          entryPayload.note(item.text, "Recipe primary note", {
                            v: 1,
                            source: "recipe_primary_note",
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
                {t("brews.primary.noRecipeNotes", "No primary notes found in the linked recipe.")}
              </EmptyState>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <LogPlannedAdditionDialog
        planned={additionDialog}
        onOpenChange={(open) => {
          if (!open) setAdditionDialog(null);
        }}
        onSave={async (input) => {
          await helpers.addAddition(input);
          setAdditionDialog(null);
        }}
      />
      <LogYeastDialog
        open={yeastDialogMode != null}
        onOpenChange={(open) => {
          if (!open) setYeastDialogMode(null);
        }}
        planned={yeastDialogMode === "planned" ? ctx.recipe.yeast : null}
        forceManual={yeastDialogMode === "manual"}
        onSave={async (input) => {
          await helpers.addAddition(input);
          setYeastDialogMode(null);
        }}
      />
    </div>
  );
}

function LogPlannedAdditionDialog({
  planned,
  onOpenChange,
  onSave
}: {
  planned: PlannedAddition | null;
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
  const [components, setComponents] = React.useState<PlannedAddition["components"]>([]);
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
    setComponents(planned.components ?? []);
  }, [planned]);

  const usesAdditiveUnits = planned?.source === "recipe_additive" || planned?.source === "recipe_go_ferm";
  const usesIngredientUnits = planned?.source === "recipe_ingredient";
  const isGoFerm = planned?.source === "recipe_go_ferm";
  const isNutrient = planned?.source === "recipe_nutrient";
  const changeGoFermType = (nextType: string) => {
    setName(nextType);

    const recalculated = calculateGoFermFromYeastAmount(nextType, planned?.meta?.actualYeastAmount);
    if (!recalculated) return;

    setAmount(String(recalculated.amount));
    setAmountTouched(false);
    setAmountDim(inferAdditiveAmountDimFromUnit("g"));
  };

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

    if (!usesAdditiveUnits) {
      setUnit(nextUnit);
      return;
    }

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

    const nextDim = nextAdditiveAmountDimOnUnitChange({
      fromUnit,
      toUnit: nextUnit,
      prevAmountDim: amountDim
    });

    setAmount(nextAmount);
    setUnit(nextUnit);
    setAmountDim(nextDim);
  };

  const save = async () => {
    if (!planned) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const parsedAmount = amount.trim() ? Number(amount) : undefined;
    const actualComponents = components ?? [];
    const componentTotal = actualComponents.reduce((sum, component) => {
      const value = Number(component.amount);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const actualAmount =
      actualComponents.length > 0
        ? componentTotal
        : typeof parsedAmount === "number" && Number.isFinite(parsedAmount)
          ? parsedAmount
          : undefined;

    setIsSaving(true);
    try {
      await onSave({
        name: trimmedName,
        amount: actualAmount,
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
          plannedVolumeUnit: planned.volumeUnit,
          actualWaterAmount:
            isGoFerm && planned.meta?.actualYeastAmount
              ? calculateGoFermFromYeastAmount(trimmedName, planned.meta.actualYeastAmount)?.water
              : planned.meta?.plannedWaterAmount,
          actualWaterUnit: isGoFerm ? "mL" : undefined,
          components: actualComponents
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
          <DialogTitle>{planned?.title ?? "Log addition"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            {isGoFerm ? (
              <Select value={name} onValueChange={changeGoFermType}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {goFermOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {t(label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            )}
          </div>

          {isNutrient ? (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              This records the recalculated recipe nutrient addition. Change the schedule settings in the recipe builder
              for now.
            </div>
          ) : null}

          {components?.length ? (
            <div className="space-y-2">
              <Label>Amounts</Label>
              <div className="space-y-2">
                {components.map((component, index) => (
                  <div key={component.key} className="grid gap-2 sm:grid-cols-[1fr_minmax(11rem,14rem)]">
                    <div className="self-center text-sm">{component.name}</div>
                    <AmountUnitField
                      amount={String(component.amount)}
                      unit={component.unit}
                      onAmountChange={(value) => {
                        if (!isValidNumber(value)) return;
                        const next = [...components];
                        next[index] = {
                          ...component,
                          amount: Number(value)
                        };
                        setComponents(next);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Amount</Label>
              {usesIngredientUnits ? (
                <div className="space-y-2">
                  <IngredientBasisSelect value={basis} onValueChange={changeBasis} t={t} />
                  <AmountUnitField
                    amount={amount}
                    unit={unit}
                    onAmountChange={changeAmount}
                    unitControl={
                      <IngredientUnitSelect
                        basis={basis}
                        value={unit}
                        onValueChange={changeUnit}
                      />
                    }
                  />
                </div>
              ) : usesAdditiveUnits ? (
                <AmountUnitField
                  amount={amount}
                  unit={unit}
                  onAmountChange={changeAmount}
                  unitControl={
                    <AdditiveUnitSelect value={unit} onValueChange={changeUnit} />
                  }
                />
              ) : (
                <AmountUnitField amount={amount} unit={unit} onAmountChange={setAmount} />
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isSaving || !name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground">{children}</div>;
}
