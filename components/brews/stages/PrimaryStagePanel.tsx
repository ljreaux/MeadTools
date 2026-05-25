"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import type { NutrientKey } from "@/types/nutrientData";
import type { StagePanelProps } from "../stageConfig";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import { entryPayload } from "@/lib/utils/entryPayload";
import { parseNumber } from "@/lib/utils/validateInput";
import { LogYeastDialog } from "@/components/brews/LogYeastDialog";
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
import {
  getPlannedIngredientAmounts,
  PlannedAdditionDialog,
  type PlannedAdditionDialogItem
} from "./additionDialogShared";

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

type PlannedAddition = PlannedAdditionDialogItem;

const nutrientLabels: Record<NutrientKey, string> = {
  fermO: "Fermaid O",
  fermK: "Fermaid K",
  dap: "DAP",
  other: "Other"
};

function loggedNutrientAdditionForIndex(
  additions: StagePanelProps["ctx"]["recipe"]["actual"]["additions"],
  index: number
) {
  return latestLoggedItem(
    additions.filter(
      (addition) =>
        addition.source === "recipe_nutrient" &&
        typeof addition.meta?.nutrientAdditionIndex === "number" &&
        addition.meta.nutrientAdditionIndex === index
    )
  );
}

function loggedNutrientComponents(
  addition: ReturnType<typeof loggedNutrientAdditionForIndex>,
  fallback: Array<{ key: string; name: string; amount: number; unit: string }>
) {
  const components = addition?.meta?.components;
  if (!Array.isArray(components)) return fallback;

  return fallback.map((planned) => {
    const actual = components.find((component) => component?.key === planned.key);
    const amount = actual?.amount;
    return {
      ...planned,
      amount: typeof amount === "number" && Number.isFinite(amount) ? amount : planned.amount,
      unit: typeof actual?.unit === "string" && actual.unit ? actual.unit : planned.unit
    };
  });
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
  const totals = plan.derived.nutrientAdditions.totalGrams;
  const otherName = plan.effectiveData.settings.other.name.trim();
  const loggedCount = ctx.recipe.actual.loggedNutrientAdditionCount ?? 0;
  const plannedCount = Math.max(0, Math.floor(plan.derived.numberOfAdditions || 0));
  const hasComponentLogs = keys.some((key) => (ctx.recipe.actual.loggedNutrientGrams[key] ?? 0) > 0);
  const remaining = keys.reduce<Record<NutrientKey, number>>(
    (acc, key) => {
      const logged = hasComponentLogs
        ? (ctx.recipe.actual.loggedNutrientGrams[key] ?? 0)
        : Math.min(loggedCount, plannedCount) * (per[key] ?? 0);
      acc[key] = Math.max(0, (totals[key] ?? 0) - logged);
      return acc;
    },
    { fermO: 0, fermK: 0, dap: 0, other: 0 }
  );
  const hasRemaining = keys.some((key) => remaining[key] > 0.01);
  const suggestedRowsRemaining = Math.max(plannedCount - loggedCount, hasRemaining ? 1 : 0);
  const targetCount = Math.max(plannedCount, loggedCount + (hasRemaining ? 1 : 0));

  const buildComponents = (divisor: number, useRemaining: boolean) => keys
    .filter((key) => selected[key])
    .map((key) => {
      const amountSource = useRemaining ? remaining[key] / Math.max(1, divisor) : per[key];
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

export function PrimaryStagePanel({
  t,
  status,
  ctx,
  helpers,
  warnings = []
}: StagePanelProps) {
  const { i18n } = useTranslation();
  const [additionDialog, setAdditionDialog] = React.useState<PlannedAddition | null>(null);
  const [yeastDialogMode, setYeastDialogMode] = React.useState<"planned" | "manual" | null>(null);
  const [recipeNoteDialog, setRecipeNoteDialog] = React.useState<{
    text: string;
    recipeNoteId: string;
  } | null>(null);
  const primaryLines = React.useMemo(
    () => buildIngredientLines(ctx.recipe.primaryIngredients, { secondaryOnly: true }),
    [ctx.recipe.primaryIngredients]
  );
  const additiveLines = React.useMemo(() => buildAdditiveLines(ctx.recipe.additives), [ctx.recipe.additives]);
  const primaryNotes = React.useMemo(() => buildNoteLines(ctx.recipe.primaryNotes), [ctx.recipe.primaryNotes]);
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
  const nutrientDoneCount = ctx.recipe.actual.loggedNutrientAdditionCount ?? loggedNutrientIndexes.size;
  const hasRemainingNutrients = Object.values(ctx.recipe.actual.remainingNutrientGrams ?? {}).some(
    (amount) => typeof amount === "number" && Number.isFinite(amount) && amount > 0.01
  );
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
  const locale = i18n.resolvedLanguage;
  const fmtNumber = (value?: number | null, decimals = 2) => formatNumber(value, decimals, locale);
  const fmtGravity = (value?: number | null) => formatGravity(value, locale);
  const fmtVolume = (value?: number | null) => formatVolume(value, "gal", locale);
  const fmtLoggedAmount = (addition?: { amount: number | null; unit: string | null } | null) =>
    formatLoggedAmount(addition, locale);
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
  const nextNutrientRow = nutrientRows.find((row) => row.index > nutrientDoneCount);
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
        const { amount, unit } = getIngredientAmount(item.line);
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
  const nutrientsPending = !pitchPending && hasRemainingNutrients;
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

      <WarningsPanel warnings={warnings} defaultOpen />

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
                    const loggedAddition = latestLoggedItem(
                      ctx.recipe.actual.additionsByRecipeIngredientId[String(item.line.lineId)]
                    );
                    const { amount, unit } = getIngredientAmount(item.line);
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
                  const loggedAddition = latestLoggedItem(
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
                {nutrientDoneCount >= Math.max(0, Math.floor(ctx.recipe.nutrientPlan?.derived.numberOfAdditions || 0)) &&
                hasRemainingNutrients ? (
                  <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-muted-foreground">
                    {t(
                      "brews.primary.nutrientsRemainingAfterPlan",
                      "Planned nutrient additions are complete, but some nutrient amount remains. Add an extra nutrient addition to finish the schedule."
                    )}
                  </div>
                ) : null}
                <ul className="space-y-1">
                  {nutrientRows.map((row) => {
                    const isLogged = row.index <= nutrientDoneCount;
                    const loggedAddition = loggedNutrientAdditionForIndex(ctx.recipe.actual.additions, row.index);
                    const displayComponents = isLogged
                      ? loggedNutrientComponents(loggedAddition, row.components)
                      : row.components;
                    const total = displayComponents.reduce((sum, item) => sum + item.amount, 0);
                    return (
                      <WorkRow
                        key={row.index}
                        title={t("brews.primary.nutrientAddition", "Nutrient addition {{index}}", {
                          index: row.index
                        })}
                        detail={displayComponents
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
                {t("brews.primary.noRecipeNotes", "No primary notes found in the linked recipe.")}
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
        defaultTitle={t("brews.primary.logAddition", "Log addition")}
        goFermOptions={goFermOptions}
        calculateGoFermFromYeastAmount={calculateGoFermFromYeastAmount}
        includeEmptyComponents
        nutrientNotice="This records the recalculated recipe nutrient addition. Change the schedule settings in the recipe builder for now."
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
      <LogRecipeNoteDialog
        note={
          recipeNoteDialog
            ? {
                title: t("brews.primary.recipeNoteTitle", "Add recipe primary note"),
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
              "Recipe primary note",
              {
                source: "recipe_primary_note",
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

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground">{children}</div>;
}
