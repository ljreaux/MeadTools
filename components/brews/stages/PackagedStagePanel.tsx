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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import { L_TO_VOLUME } from "@/lib/utils/recipeDataCalculations";
import { entryPayload, type BrewPackagingData } from "@/lib/utils/entryPayload";
import type { RecipeUnitDefaults } from "@/types/recipeData";
import type { StagePanelProps } from "../stageConfig";
import { StatusTile } from "./StagePanelShared";

function fmtNumber(value?: number | null, decimals = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

function fmtVolume(liters?: number | null, unit: RecipeUnitDefaults["volume"] = "gal") {
  if (typeof liters !== "number" || !Number.isFinite(liters) || liters <= 0) return "—";
  return `${fmtNumber(liters * L_TO_VOLUME[unit])} ${unit}`;
}

function getPackagingEntries(ctx: StagePanelProps["ctx"]) {
  return ctx.brew.entries
    .filter((entry) => entry.type === BREW_ENTRY_TYPE.PACKAGING)
    .sort((a, b) => {
      const aValue = (a as any).datetime ?? a.createdAt;
      const bValue = (b as any).datetime ?? b.createdAt;
      const aTime = typeof aValue === "string" ? new Date(aValue).getTime() : 0;
      const bTime = typeof bValue === "string" ? new Date(bValue).getTime() : 0;
      return bTime - aTime;
    });
}

function getLatestPackaging(ctx: StagePanelProps["ctx"]) {
  return getPackagingEntries(ctx)[0] ?? null;
}

function getPackageCount(data?: BrewPackagingData | null) {
  return (data?.bottleRows ?? []).reduce((sum, row) => sum + row.quantity, 0);
}

const VOLUME_CHANGE_THRESHOLD_L = 0.01;

export function PackagedStagePanel({ t, status, ctx, helpers, warnings = [] }: StagePanelProps) {
  const bottling = useBottlingRows();
  const [datetime, setDatetime] = React.useState<Date>(new Date());
  const [note, setNote] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [warningsOpen, setWarningsOpen] = React.useState(false);
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
          value={fmtVolume(displayPackagedVolume, unit)}
          tone={displayPackagedVolume ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.packaged.packageCount", "Package count")}
          value={packageCount > 0 ? fmtNumber(packageCount, 0) : "—"}
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

      <div className="rounded-md border border-border bg-background/40 px-3 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {t("brews.packaged.focus", "Record packaging details and finish the brew")}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t(
                "brews.packaged.workflowHint",
                "Save package sizes, counts, and volume before marking the brew complete."
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
            <Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => openEntry(BREW_ENTRY_TYPE.ISSUE)}>
              {t("brews.bulkAge.addIssue", "Add issue")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => setCompleteDialogOpen(true)}>
              {t("brews.bulkAge.markComplete", "Mark Complete")}
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
            {fmtVolume(latestPackagingData?.packagedVolumeLiters, unit)}
            {packageCount > 0
              ? ` · ${fmtNumber(packageCount, 0)} ${t("brews.packaged.packages", "packages")}`
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
                    {fmtNumber(row.quantity, 0)} {row.label}
                  </span>
                  {row.totalLiters > 0 ? (
                    <span className="text-muted-foreground">
                      {fmtVolume(row.totalLiters, unit)}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
          {latestPackaging.note ? <div className="mt-2">{latestPackaging.note}</div> : null}
        </div>
      ) : null}

      <PackagedCompleteDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        onMove={async (datetimeIso) => {
          await helpers.moveToStage("COMPLETE", datetimeIso);
          setCompleteDialogOpen(false);
        }}
      />
    </div>
  );
}

function PackagedCompleteDialog({
  open,
  onOpenChange,
  onMove
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMove: (datetime: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [datetime, setDatetime] = React.useState<Date>(new Date());
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setDatetime(new Date());
  }, [open]);

  const move = async () => {
    setIsSaving(true);
    try {
      await onMove(datetime.toISOString());
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("brews.bulkAge.markComplete", "Mark Complete")}</DialogTitle>
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
