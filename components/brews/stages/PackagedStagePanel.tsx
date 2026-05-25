"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";

import {
  BottlingCalculator,
  L_PER_GAL,
  getPackagingBottleRows,
  useBottlingRows
} from "@/components/extraCalcs/BottlingCalculator";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import { entryPayload, type BrewPackagingData } from "@/lib/utils/entryPayload";
import type { StagePanelProps } from "../stageConfig";
import { DateConfirmDialog, formatNumber, formatVolume, latestLoggedItem, StageFocusActions, StatusTile, WarningsPanel } from "./StagePanelShared";

function getLatestPackaging(ctx: StagePanelProps["ctx"]) {
  return latestLoggedItem(ctx.brew.entries.filter((entry) => entry.type === BREW_ENTRY_TYPE.PACKAGING));
}

function getPackageCount(data?: BrewPackagingData | null) {
  return (data?.bottleRows ?? []).reduce((sum, row) => sum + row.quantity, 0);
}

const VOLUME_CHANGE_THRESHOLD_L = 0.01;

export function PackagedStagePanel({ t, status, ctx, helpers, warnings = [] }: StagePanelProps) {
  const { i18n } = useTranslation();
  const bottling = useBottlingRows();
  const [datetime, setDatetime] = React.useState<Date>(new Date());
  const [note, setNote] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = React.useState(false);

  const unit = ctx.recipe.recipeData?.unitDefaults.volume ?? ctx.recipe.derived?.volume.unit ?? "gal";
  const canEdit = status === "current";
  const latestPackaging = getLatestPackaging(ctx);
  const latestPackagingData = latestPackaging?.data as BrewPackagingData | null | undefined;
  const savedPackagedVolume = latestPackagingData?.packagedVolumeLiters ?? null;
  const currentVolume = ctx.brew.current_volume_liters;
  const displayPackagedVolume = savedPackagedVolume ?? currentVolume;
  const packageCount = getPackageCount(latestPackagingData);
  const saveVolumeLiters =
    bottling.totalVolumeBottledL > 0 ? bottling.totalVolumeBottledL : bottling.totalTargetVolumeL;
  const displayValue =
    bottling.volumeUnits === "gallons" ? saveVolumeLiters / L_PER_GAL : saveVolumeLiters;
  const displayUnit = bottling.volumeUnits === "gallons" ? "gal" : "L";
  const bottleRows = getPackagingBottleRows(bottling.bottleRows, bottling.getPerBottleLiters);
  const locale = i18n.resolvedLanguage;

  React.useEffect(() => {
    if (latestPackagingData?.packagedVolumeLiters) {
      const savedDisplayUnit = latestPackagingData.displayUnit;
      const useGallons = savedDisplayUnit === "gal";
      bottling.setVolumeUnits(useGallons ? "gallons" : "liters");
      bottling.setTotalVolume(
        String(
          Number(
            (typeof latestPackagingData.displayValue === "number"
              ? latestPackagingData.displayValue
              : useGallons
                ? latestPackagingData.packagedVolumeLiters / L_PER_GAL
                : latestPackagingData.packagedVolumeLiters
            ).toFixed(3)
          )
        )
      );
      bottling.loadPackagingRows(latestPackagingData.bottleRows ?? []);
      return;
    }

    const source =
      typeof currentVolume === "number" && Number.isFinite(currentVolume) && currentVolume > 0
        ? currentVolume
        : ctx.brew.effective_current_volume_liters;
    if (typeof source !== "number" || !Number.isFinite(source) || source <= 0) return;

    if (unit === "L" || unit === "mL") {
      bottling.setVolumeUnits("liters");
      bottling.setTotalVolume(String(Number((source).toFixed(2))));
    } else {
      bottling.setVolumeUnits("gallons");
      bottling.setTotalVolume(String(Number((source / L_PER_GAL).toFixed(2))));
    }
  }, [latestPackaging?.id]);

  const openEntry = (
    type:
      | typeof BREW_ENTRY_TYPE.NOTE
      | typeof BREW_ENTRY_TYPE.TASTING
      | typeof BREW_ENTRY_TYPE.ISSUE
  ) => {
    helpers.openAddEntry?.({
      presetType: type,
      allowedTypes: [type]
    });
  };

  const savePackaging = async () => {
    if (!Number.isFinite(saveVolumeLiters) || saveVolumeLiters <= 0) return;

    setIsSaving(true);
    try {
      const datetimeIso = datetime.toISOString();
      const hasCurrentVolume =
        typeof currentVolume === "number" &&
        Number.isFinite(currentVolume) &&
        currentVolume > 0;
      const volumeChanged =
        !hasCurrentVolume ||
        Math.abs(saveVolumeLiters - currentVolume) > VOLUME_CHANGE_THRESHOLD_L;

      const packagingInput = entryPayload.packaging({
        packagedVolumeLiters: saveVolumeLiters,
        displayValue,
        displayUnit,
        bottleRows,
        note: note.trim() || null,
        datetime: datetimeIso
      });

      if (latestPackaging && helpers.patchEntry) {
        await helpers.patchEntry(latestPackaging.id, {
          datetime: datetimeIso,
          title: packagingInput.title,
          note: packagingInput.note,
          data: packagingInput.data
        });
      } else {
        await helpers.addEntry(packagingInput);
      }

      if (volumeChanged) {
        await helpers.patchBrewMetadata({ current_volume_liters: saveVolumeLiters });
        await helpers.addEntry(
          entryPayload.volume({
            liters: saveVolumeLiters,
            displayValue,
            displayUnit,
            note: t("brews.packaged.volumeEntryNote", "Packaged volume"),
            datetime: datetimeIso
          })
        );
      }
      setNote("");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatusTile
          label={t("brews.packaged.packagedVolume", "Packaged volume")}
          value={formatVolume(displayPackagedVolume, unit, locale)}
          tone={displayPackagedVolume ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.packaged.packageCount", "Package count")}
          value={packageCount > 0 ? formatNumber(packageCount, 0, locale) : "—"}
          tone={latestPackaging ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.packaged.completion", "Completion")}
          value={
            latestPackaging && displayPackagedVolume
              ? t("brews.packaged.ready", "Ready")
              : t("brews.packaged.needsPackaging", "Needs packaging")
          }
          tone={latestPackaging && displayPackagedVolume ? "ok" : "warn"}
        />
      </div>

      <StageFocusActions
        title={t("brews.packaged.focus", "Record packaging details and finish the brew")}
        description={t(
          "brews.packaged.workflowHint",
          "Save package sizes, counts, and volume before marking the brew complete."
        )}
      >
            <Button size="sm" disabled={!canEdit} onClick={() => openEntry(BREW_ENTRY_TYPE.NOTE)}>
              {t("brews.bulkAge.addNote", "Add note")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => openEntry(BREW_ENTRY_TYPE.TASTING)}>
              {t("brews.bulkAge.addTasting", "Add tasting")}
            </Button>
            <Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => openEntry(BREW_ENTRY_TYPE.ISSUE)}>
              {t("brews.bulkAge.addIssue", "Add issue")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => setCompleteDialogOpen(true)}>
              {t("brews.bulkAge.markComplete", "Mark Complete")}
            </Button>
      </StageFocusActions>

      <WarningsPanel warnings={warnings} />

      <div className="rounded-md border border-border bg-background/40 p-3">
        <div className="space-y-2">
          <div className="max-w-sm space-y-2">
            <Label>{t("date", "Date")}</Label>
            <DateTimePicker value={datetime} onChange={(value) => value && setDatetime(value)} hourCycle={12} />
          </div>
        </div>

        <div className="mt-4">
          <BottlingCalculator state={bottling} compact />
        </div>

        <div className="mt-4 space-y-2">
          <Label>{t("note", "Note")}</Label>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={savePackaging} disabled={!canEdit || isSaving || saveVolumeLiters <= 0}>
            {t("brews.packaged.savePackaging", "Save packaging")}
          </Button>
        </div>
      </div>

      {latestPackaging ? (
        <div className="rounded-md border border-border bg-background/40 px-3 py-3 text-sm">
          <div className="font-medium">
            {t("brews.packaged.latestPackaging", "Latest packaging")}
          </div>
          <div className="mt-1 text-muted-foreground">
            {formatVolume(latestPackagingData?.packagedVolumeLiters, unit, locale)}
            {packageCount > 0
              ? ` · ${formatNumber(packageCount, 0, locale)} ${t("brews.packaged.packages", "packages")}`
              : ""}
          </div>
          {latestPackagingData?.bottleRows?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {latestPackagingData.bottleRows.map((row, idx) => (
                <span
                  key={`${row.label}-${idx}`}
                  className="inline-flex items-baseline gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs"
                >
                  <span className="font-medium text-foreground">
                    {formatNumber(row.quantity, 0, locale)} {row.label}
                  </span>
                  {row.totalLiters > 0 ? (
                    <span className="text-muted-foreground">
                      {formatVolume(row.totalLiters, unit, locale)}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
          {latestPackaging.note ? <div className="mt-2">{latestPackaging.note}</div> : null}
        </div>
      ) : null}

      <DateConfirmDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        title={t("brews.bulkAge.markComplete", "Mark Complete")}
        onConfirm={async (datetimeIso) => {
          await helpers.moveToStage("COMPLETE", datetimeIso);
          setCompleteDialogOpen(false);
        }}
      />
    </div>
  );
}
