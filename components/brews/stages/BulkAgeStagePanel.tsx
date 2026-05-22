"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import {
  convertAdditiveAmount,
  inferAdditiveAmountDimFromUnit,
  L_TO_VOLUME,
  nextAdditiveAmountDimOnUnitChange,
  shouldConvertAdditiveAmount,
  type UnitDim
} from "@/lib/utils/recipeDataCalculations";
import { isValidNumber } from "@/lib/utils/validateInput";
import type { AdditiveLine, IngredientLine, RecipeUnitDefaults } from "@/types/recipeData";
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

type AdditionSource = "recipe_ingredient" | "recipe_additive";
type AdditionKind = "INGREDIENT" | "OTHER";

type PlannedBulkAgeAddition = {
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

export function BulkAgeStagePanel({ t, status, ctx, helpers, warnings = [] }: StagePanelProps) {
  const [additionDialog, setAdditionDialog] = React.useState<PlannedBulkAgeAddition | null>(null);
  const [warningsOpen, setWarningsOpen] = React.useState(false);
  const [stageMove, setStageMove] = React.useState<"PACKAGED" | "COMPLETE" | null>(null);

  const canEdit = status === "current";
  const unit = ctx.recipe.recipeData?.unitDefaults.volume ?? ctx.recipe.derived?.volume.unit ?? "gal";
  const finalGravity = ctx.recipe.actual.finalGravity?.gravity ?? null;
  const hasCurrentVolume =
    typeof ctx.brew.current_volume_liters === "number" &&
    Number.isFinite(ctx.brew.current_volume_liters) &&
    ctx.brew.current_volume_liters > 0;

  const loggedIngredientIds = React.useMemo(
    () => new Set(ctx.recipe.actual.loggedRecipeIngredientIds),
    [ctx.recipe.actual.loggedRecipeIngredientIds]
  );
  const loggedAdditiveIds = React.useMemo(
    () => new Set(ctx.recipe.actual.loggedRecipeAdditiveIds),
    [ctx.recipe.actual.loggedRecipeAdditiveIds]
  );

  const secondaryLines = React.useMemo(
    () => buildSecondaryLines(ctx.recipe.secondaryIngredients),
    [ctx.recipe.secondaryIngredients]
  );
  const additiveLines = React.useMemo(
    () => buildAdditiveLines(ctx.recipe.additives),
    [ctx.recipe.additives]
  );
  const missingSecondary = secondaryLines.filter((item) => !loggedIngredientIds.has(String(item.line.lineId)));
  const missingAdditives = additiveLines.filter((item) => !loggedAdditiveIds.has(String(item.line.lineId)));
  const outstandingCount = missingSecondary.length + missingAdditives.length;

  const openEntry = (type: typeof BREW_ENTRY_TYPE.NOTE | typeof BREW_ENTRY_TYPE.TASTING | typeof BREW_ENTRY_TYPE.ISSUE | typeof BREW_ENTRY_TYPE.GRAVITY) => {
    helpers.openAddEntry?.({
      presetType: type,
      allowedTypes: [type]
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatusTile
          label={t("brews.bulkAge.currentVolume", "Current volume")}
          value={fmtVolume(ctx.brew.current_volume_liters, unit)}
          tone={hasCurrentVolume ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.bulkAge.latestGravity", "Latest gravity")}
          value={fmtGravity(ctx.brew.latest_gravity)}
          tone="ok"
        />
        <StatusTile
          label={t("brews.bulkAge.finalGravity", "Final gravity")}
          value={fmtGravity(finalGravity)}
          tone={finalGravity ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.bulkAge.outstandingItems", "Outstanding items")}
          value={String(outstandingCount)}
          tone={outstandingCount === 0 ? "ok" : "warn"}
        />
      </div>

      <div className="rounded-md border border-border bg-background/40 px-3 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {t("brews.bulkAge.focus", "Track aging notes and package when ready")}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t(
                "brews.bulkAge.workflowHint",
                "Notes are the main log here; use readings and outstanding items only when they help."
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!canEdit} onClick={() => openEntry(BREW_ENTRY_TYPE.NOTE)}>
              {t("brews.bulkAge.addNote", "Add note")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => openEntry(BREW_ENTRY_TYPE.TASTING)}>
              {t("brews.bulkAge.addTasting", "Add tasting")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => openEntry(BREW_ENTRY_TYPE.GRAVITY)}>
              {t("brews.actions.logGravity", "Log gravity")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => helpers.openRecordVolume?.()}>
              {t("brews.actions.logVolume", "Record volume")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => setStageMove("PACKAGED")}>
              {t("brews.bulkAge.moveToPackaged", "Move to Packaged")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => setStageMove("COMPLETE")}>
              {t("brews.bulkAge.markComplete", "Mark Complete")}
            </Button>
            <Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => openEntry(BREW_ENTRY_TYPE.ISSUE)}>
              {t("brews.bulkAge.addIssue", "Add issue")}
            </Button>
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

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {t("brews.bulkAge.outstandingRecipeItems", "Outstanding recipe items")} · {outstandingCount}
        </div>
        {outstandingCount > 0 ? (
          <ul className="space-y-1">
            {missingSecondary.map((item) => {
              const loggedAddition = latestLoggedAddition(
                ctx.recipe.actual.additionsByRecipeIngredientId[String(item.line.lineId)]
              );
              const { amount, unit } = getRecipeAmount(item.line);
              return (
                <WorkRow
                  key={`ingredient-${item.line.lineId}`}
                  title={loggedAddition?.name || item.name}
                  detail={item.secondary ? `${t("brews.planned.altAmount", "Alt")}: ${item.secondary}` : null}
                  amount={fmtLoggedAmount(loggedAddition) ?? item.primary}
                  isLogged={false}
                  disabled={!canEdit}
                  loggedLabel={t("brews.primary.logged", "Logged")}
                  actionLabel={t("brews.primary.log", "Log")}
                  onLog={() =>
                    setAdditionDialog({
                      title: t("brews.bulkAge.logIngredient", "Log ingredient"),
                      name: item.name,
                      kind: "INGREDIENT",
                      source: "recipe_ingredient",
                      amount,
                      unit,
                      ...getPlannedIngredientAmounts(item.line),
                      recipeIngredientId: String(item.line.lineId),
                      meta: { plannedAmount: amount, plannedUnit: unit, stage: "BULK_AGE" }
                    })
                  }
                />
              );
            })}
            {missingAdditives.map((item) => {
              const loggedAddition = latestLoggedAddition(
                ctx.recipe.actual.additionsByRecipeAdditiveId[String(item.line.lineId)]
              );
              const { amount, unit } = getAdditiveAmount(item.line);
              return (
                <WorkRow
                  key={`additive-${item.line.lineId}`}
                  title={loggedAddition?.name || item.name}
                  amount={fmtLoggedAmount(loggedAddition) ?? item.amount}
                  isLogged={false}
                  disabled={!canEdit}
                  loggedLabel={t("brews.primary.logged", "Logged")}
                  actionLabel={t("brews.primary.log", "Log")}
                  onLog={() =>
                    setAdditionDialog({
                      title: t("brews.bulkAge.logAdditive", "Log additive"),
                      name: item.name,
                      kind: "OTHER",
                      source: "recipe_additive",
                      amount,
                      unit,
                      recipeAdditiveId: String(item.line.lineId),
                      meta: { plannedAmount: amount, plannedUnit: unit, stage: "BULK_AGE" }
                    })
                  }
                />
              );
            })}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground">
            {t("brews.bulkAge.noOutstandingItems", "No outstanding linked recipe items.")}
          </div>
        )}
      </div>

      <LogBulkAgeAdditionDialog
        planned={additionDialog}
        onOpenChange={(open) => {
          if (!open) setAdditionDialog(null);
        }}
        onSave={async (input) => {
          await helpers.addAddition(input);
          setAdditionDialog(null);
        }}
      />
      <BulkAgeStageMoveDialog
        stage={stageMove}
        onOpenChange={(open) => {
          if (!open) setStageMove(null);
        }}
        onMove={async (datetime) => {
          if (!stageMove) return;
          await helpers.moveToStage(stageMove, datetime);
          setStageMove(null);
        }}
      />
    </div>
  );
}

function LogBulkAgeAdditionDialog({
  planned,
  onOpenChange,
  onSave
}: {
  planned: PlannedBulkAgeAddition | null;
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
    datetime?: string;
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
  const [datetime, setDatetime] = React.useState<Date>(new Date());
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
    setDatetime(new Date());
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
        datetime: datetime.toISOString(),
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
          stage: "BULK_AGE"
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
          <DialogTitle>{planned?.title ?? t("brews.bulkAge.logAddition", "Log addition")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("name", "Name")}</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t("amount", "Amount")}</Label>
            {usesIngredientUnits ? <IngredientBasisSelect value={basis} onValueChange={changeBasis} t={t} /> : null}
            <AmountUnitField
              amount={amount}
              unit={unit}
              onAmountChange={changeAmount}
              unitControl={
                usesIngredientUnits ? (
                  <IngredientUnitSelect basis={basis} value={unit} onValueChange={changeUnit} />
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

          <div className="space-y-2">
            <Label>{t("date", "Date")}</Label>
            <DateTimePicker value={datetime} onChange={(value) => value && setDatetime(value)} hourCycle={12} />
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

function BulkAgeStageMoveDialog({
  stage,
  onOpenChange,
  onMove
}: {
  stage: "PACKAGED" | "COMPLETE" | null;
  onOpenChange: (open: boolean) => void;
  onMove: (datetime: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [datetime, setDatetime] = React.useState<Date>(new Date());
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (stage) setDatetime(new Date());
  }, [stage]);

  const move = async () => {
    setIsSaving(true);
    try {
      await onMove(datetime.toISOString());
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(stage)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {stage === "COMPLETE"
              ? t("brews.bulkAge.markComplete", "Mark Complete")
              : t("brews.bulkAge.moveToPackaged", "Move to Packaged")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>{t("date", "Date")}</Label>
          <DateTimePicker value={datetime} onChange={(value) => value && setDatetime(value)} hourCycle={12} />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("cancel", "Cancel")}
          </Button>
          <Button onClick={move} disabled={isSaving}>
            {t("save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
