"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import type { StagePanelProps } from "../stageConfig";
import {
  getBrewItemLabel,
  getPlannedIngredientAmounts,
  PlannedAdditionDialog,
  type PlannedAdditionDialogItem
} from "./additionDialogShared";
import {
  buildAdditiveLines,
  buildIngredientLines,
  DateConfirmDialog,
  formatGravity,
  formatLoggedAmount,
  formatVolume,
  getAdditiveAmount,
  getIngredientAmount,
  latestLoggedItem,
  StageFocusActions,
  StatusTile,
  WarningsPanel,
  WorkRow
} from "./StagePanelShared";

export function BulkAgeStagePanel({
  t,
  status,
  ctx,
  helpers,
  warnings = [],
  readOnly = false
}: StagePanelProps) {
  const { i18n } = useTranslation();
  const [additionDialog, setAdditionDialog] =
    React.useState<PlannedAdditionDialogItem | null>(null);
  const [stageMove, setStageMove] = React.useState<
    "PACKAGED" | "COMPLETE" | null
  >(null);

  const canEdit = status === "current" && !readOnly;
  const unit =
    ctx.recipe.recipeData?.unitDefaults.volume ??
    ctx.recipe.derived?.volume.unit ??
    "gal";
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
    () => buildIngredientLines(ctx.recipe.secondaryIngredients),
    [ctx.recipe.secondaryIngredients]
  );
  const additiveLines = React.useMemo(
    () => buildAdditiveLines(ctx.recipe.additives),
    [ctx.recipe.additives]
  );
  const missingSecondary = secondaryLines.filter(
    (item) => !loggedIngredientIds.has(String(item.line.lineId))
  );
  const missingAdditives = additiveLines.filter(
    (item) => !loggedAdditiveIds.has(String(item.line.lineId))
  );
  const outstandingCount = missingSecondary.length + missingAdditives.length;
  const locale = i18n.resolvedLanguage;

  const openEntry = (
    type:
      | typeof BREW_ENTRY_TYPE.NOTE
      | typeof BREW_ENTRY_TYPE.TASTING
      | typeof BREW_ENTRY_TYPE.ISSUE
      | typeof BREW_ENTRY_TYPE.GRAVITY
  ) => {
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
          value={formatVolume(ctx.brew.current_volume_liters, unit, locale)}
          tone={hasCurrentVolume ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.bulkAge.latestGravity", "Latest gravity")}
          value={formatGravity(ctx.brew.latest_gravity, locale)}
          tone="ok"
        />
        <StatusTile
          label={t("brews.bulkAge.finalGravity", "Final gravity")}
          value={formatGravity(finalGravity, locale)}
          tone={finalGravity ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.bulkAge.outstandingItems", "Outstanding items")}
          value={String(outstandingCount)}
          tone={outstandingCount === 0 ? "ok" : "warn"}
        />
      </div>

      <StageFocusActions
        title={t(
          "brews.bulkAge.focus",
          "Track aging notes and package when ready"
        )}
        description={t(
          "brews.bulkAge.workflowHint",
          "Notes are the main log here; use readings and outstanding items only when they help."
        )}
      >
        <Button
          size="sm"
          disabled={!canEdit}
          onClick={() => openEntry(BREW_ENTRY_TYPE.NOTE)}
        >
          {t("brews.bulkAge.addNote", "Add note")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!canEdit}
          onClick={() => openEntry(BREW_ENTRY_TYPE.TASTING)}
        >
          {t("brews.bulkAge.addTasting", "Add tasting")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!canEdit}
          onClick={() => openEntry(BREW_ENTRY_TYPE.GRAVITY)}
        >
          {t("brews.actions.logGravity", "Log gravity")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!canEdit}
          onClick={() => helpers.openRecordVolume?.()}
        >
          {t("brews.actions.logVolume", "Record volume")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!canEdit}
          onClick={() => setStageMove("PACKAGED")}
        >
          {t("brews.bulkAge.moveToPackaged", "Move to Packaged")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!canEdit}
          onClick={() => setStageMove("COMPLETE")}
        >
          {t("brews.bulkAge.markComplete", "Mark Complete")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canEdit}
          onClick={() => openEntry(BREW_ENTRY_TYPE.ISSUE)}
        >
          {t("brews.bulkAge.addIssue", "Add issue")}
        </Button>
      </StageFocusActions>

      <WarningsPanel warnings={warnings} />

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {t(
            "brews.bulkAge.outstandingRecipeItems",
            "Outstanding recipe items"
          )}{" "}
          · {outstandingCount}
        </div>
        {outstandingCount > 0 ? (
          <ul className="space-y-1">
            {missingSecondary.map((item) => {
              const loggedAddition = latestLoggedItem(
                ctx.recipe.actual.additionsByRecipeIngredientId[
                  String(item.line.lineId)
                ]
              );
              const { amount, unit } = getIngredientAmount(item.line);
              return (
                <WorkRow
                  key={`ingredient-${item.line.lineId}`}
                  title={getBrewItemLabel(t, loggedAddition?.name || item.name)}
                  detail={
                    item.secondary
                      ? `${t("brews.planned.altAmount", "Alt")}: ${item.secondary}`
                      : null
                  }
                  amount={
                    formatLoggedAmount(loggedAddition, locale) ?? item.primary
                  }
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
                      meta: {
                        plannedAmount: amount,
                        plannedUnit: unit,
                        stage: "BULK_AGE"
                      }
                    })
                  }
                />
              );
            })}
            {missingAdditives.map((item) => {
              const loggedAddition = latestLoggedItem(
                ctx.recipe.actual.additionsByRecipeAdditiveId[
                  String(item.line.lineId)
                ]
              );
              const { amount, unit } = getAdditiveAmount(item.line);
              return (
                <WorkRow
                  key={`additive-${item.line.lineId}`}
                  title={getBrewItemLabel(t, loggedAddition?.name || item.name)}
                  amount={
                    formatLoggedAmount(loggedAddition, locale) ?? item.amount
                  }
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
                      meta: {
                        plannedAmount: amount,
                        plannedUnit: unit,
                        stage: "BULK_AGE"
                      }
                    })
                  }
                />
              );
            })}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground">
            {t(
              "brews.bulkAge.noOutstandingItems",
              "No outstanding linked recipe items."
            )}
          </div>
        )}
      </div>

      <PlannedAdditionDialog
        planned={additionDialog}
        onOpenChange={(open) => {
          if (!open) setAdditionDialog(null);
        }}
        onSave={async (input) => {
          await helpers.addAddition(input);
          setAdditionDialog(null);
        }}
        defaultTitle={t("brews.bulkAge.logAddition", "Log addition")}
        stage="BULK_AGE"
      />
      <DateConfirmDialog
        open={Boolean(stageMove)}
        onOpenChange={(open) => {
          if (!open) setStageMove(null);
        }}
        title={
          stageMove === "COMPLETE"
            ? t("brews.bulkAge.markComplete", "Mark Complete")
            : t("brews.bulkAge.moveToPackaged", "Move to Packaged")
        }
        onConfirm={async (datetime) => {
          if (!stageMove) return;
          await helpers.moveToStage(stageMove, datetime);
          setStageMove(null);
        }}
      />
    </div>
  );
}
