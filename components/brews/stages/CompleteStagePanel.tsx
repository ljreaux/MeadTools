"use client";

import { Button } from "@/components/ui/button";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import { L_TO_VOLUME } from "@/lib/utils/recipeDataCalculations";
import { calcABV } from "@/lib/utils/unitConverter";
import type { BrewPackagingData } from "@/lib/utils/entryPayload";
import type { RecipeUnitDefaults } from "@/types/recipeData";
import type { StagePanelProps } from "../stageConfig";
import { StatusTile } from "./StagePanelShared";

function fmtNumber(value?: number | null, decimals = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

function fmtGravity(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "-";
  return value.toFixed(3);
}

function fmtAbv(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "-";
  return `${fmtNumber(value, 2)}%`;
}

function fmtVolume(liters?: number | null, unit: RecipeUnitDefaults["volume"] = "gal") {
  if (typeof liters !== "number" || !Number.isFinite(liters) || liters <= 0) return "-";
  return `${fmtNumber(liters * L_TO_VOLUME[unit])} ${unit}`;
}

function getEntryTime(entry: StagePanelProps["ctx"]["brew"]["entries"][number]) {
  const value = entry.datetime ?? entry.createdAt;
  if (typeof value !== "string") return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortNewestFirst<T extends StagePanelProps["ctx"]["brew"]["entries"][number]>(entries: T[]) {
  return [...entries].sort((a, b) => getEntryTime(b) - getEntryTime(a));
}

function getLatestPackaging(ctx: StagePanelProps["ctx"]) {
  return (
    sortNewestFirst(ctx.brew.entries.filter((entry) => entry.type === BREW_ENTRY_TYPE.PACKAGING))[0] ??
    null
  );
}

function getPackageCount(data?: BrewPackagingData | null) {
  return (data?.bottleRows ?? []).reduce((sum, row) => sum + row.quantity, 0);
}

function getCompletionDate(ctx: StagePanelProps["ctx"]) {
  const completionEntry = sortNewestFirst(
    ctx.brew.entries.filter(
      (entry) => entry.type === BREW_ENTRY_TYPE.STAGE_CHANGE && (entry.data as any)?.to === "COMPLETE"
    )
  )[0];

  const fallbackEntry = sortNewestFirst(ctx.brew.entries)[0];
  return (
    completionEntry?.datetime ??
    completionEntry?.createdAt ??
    fallbackEntry?.datetime ??
    fallbackEntry?.createdAt ??
    null
  );
}

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function getFinalNotes(ctx: StagePanelProps["ctx"]) {
  const tastings = sortNewestFirst(
    ctx.brew.entries.filter((entry) => entry.type === BREW_ENTRY_TYPE.TASTING)
  );
  if (tastings.length > 0) return tastings.slice(0, 3);

  return sortNewestFirst(ctx.brew.entries.filter((entry) => entry.type === BREW_ENTRY_TYPE.NOTE)).slice(
    0,
    3
  );
}

export function CompleteStagePanel({ t, status, ctx, helpers }: StagePanelProps) {
  const unit = ctx.recipe.recipeData?.unitDefaults.volume ?? ctx.recipe.derived?.volume.unit ?? "gal";
  const latestPackaging = getLatestPackaging(ctx);
  const latestPackagingData = latestPackaging?.data as BrewPackagingData | null | undefined;
  const packagedVolume = latestPackagingData?.packagedVolumeLiters ?? null;
  const packageCount = getPackageCount(latestPackagingData);
  const originalGravity = ctx.recipe.actual.originalGravity?.gravity ?? null;
  const finalGravity = ctx.recipe.actual.finalGravity?.gravity ?? null;
  const latestGravity = ctx.recipe.actual.latestGravity ?? ctx.brew.latest_gravity ?? ctx.brew.effective_latest_gravity ?? null;
  const hasTastings = ctx.brew.entries.some((entry) => entry.type === BREW_ENTRY_TYPE.TASTING);
  const abv =
    typeof ctx.recipe.actual.currentAbv === "number" && Number.isFinite(ctx.recipe.actual.currentAbv)
      ? ctx.recipe.actual.currentAbv
      : typeof originalGravity === "number" &&
          Number.isFinite(originalGravity) &&
          typeof finalGravity === "number" &&
          Number.isFinite(finalGravity)
        ? calcABV(originalGravity, finalGravity)
        : null;
  const finalNotes = getFinalNotes(ctx);
  const canAddEntry = status === "current";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatusTile
          label={t("brews.complete.completed", "Completed")}
          value={fmtDate(getCompletionDate(ctx))}
          tone="ok"
        />
        <StatusTile
          label={t("brews.complete.abv", "ABV")}
          value={fmtAbv(abv)}
          tone={abv != null ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.complete.packagedVolume", "Packaged volume")}
          value={fmtVolume(packagedVolume, unit)}
          tone={packagedVolume ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.packaged.packageCount", "Package count")}
          value={packageCount > 0 ? fmtNumber(packageCount, 0) : "-"}
          tone={packageCount > 0 ? "ok" : "warn"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatusTile
          label={t("brews.complete.originalGravity", "Original gravity")}
          value={fmtGravity(originalGravity)}
          tone={originalGravity ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.complete.finalGravity", "Final gravity")}
          value={fmtGravity(finalGravity)}
          tone={finalGravity ? "ok" : "warn"}
        />
        <StatusTile
          label={t("iSpindelDashboard.brews.latestGrav", "Latest gravity")}
          value={fmtGravity(latestGravity)}
          tone={latestGravity ? "ok" : "warn"}
        />
      </div>

      <div className="rounded-md border border-border bg-background/40 px-3 py-3 text-sm">
        <div className="font-medium">{t("brews.complete.packagingRecap", "Packaging recap")}</div>
        <div className="mt-1 text-muted-foreground">
          {fmtVolume(latestPackagingData?.packagedVolumeLiters, unit)}
          {packageCount > 0
            ? ` - ${fmtNumber(packageCount, 0)} ${t("brews.packaged.packages", "packages")}`
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
                  <span className="text-muted-foreground">{fmtVolume(row.totalLiters, unit)}</span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
        {latestPackaging?.note ? <div className="mt-3 whitespace-pre-line">{latestPackaging.note}</div> : null}
        {!latestPackaging ? (
          <div className="mt-2 text-muted-foreground">
            {t("brews.complete.noPackaging", "No packaging details recorded.")}
          </div>
        ) : null}
      </div>

      <div className="rounded-md border border-border bg-background/40 px-3 py-3">
        <div className="text-sm font-medium">
          {hasTastings
            ? t("brews.complete.recentTastings", "Recent tastings")
            : t("brews.complete.recentNotes", "Recent notes")}
        </div>
        {finalNotes.length > 0 ? (
          <div className="mt-3 space-y-3">
            {finalNotes.map((entry) => (
              <div key={entry.id} className="border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-sm font-medium">
                    {entry.title ||
                      (entry.type === BREW_ENTRY_TYPE.TASTING
                        ? t("tasting", "Tasting")
                        : t("note", "Note"))}
                  </div>
                  <div className="text-xs text-muted-foreground">{fmtDate(entry.datetime ?? entry.createdAt)}</div>
                </div>
                {entry.note ? (
                  <div className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{entry.note}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">
            {t("brews.complete.noFinalNotes", "No tastings or notes recorded yet.")}
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-background/40 px-3 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium">{t("brews.actions.addEntry", "Add entry")}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("brews.complete.addEntryHint", "Add any final reading, tasting, issue, or note.")}
            </div>
          </div>
          {canAddEntry ? (
            <Button
              size="sm"
              onClick={() =>
                helpers.openAddEntry?.({
                  allowedTypes: [
                    BREW_ENTRY_TYPE.GRAVITY,
                    BREW_ENTRY_TYPE.TEMPERATURE,
                    BREW_ENTRY_TYPE.PH,
                    BREW_ENTRY_TYPE.NOTE,
                    BREW_ENTRY_TYPE.TASTING,
                    BREW_ENTRY_TYPE.ISSUE
                  ]
                })
              }
            >
              {t("brews.actions.addEntry", "Add entry")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
