"use client";

import { Button } from "@/components/ui/button";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import { calcABV } from "@meadtools/core/gravity";
import type { BrewPackagingData } from "@/lib/utils/entryPayload";
import type { StagePanelProps } from "../stageConfig";
import {
  formatGravity,
  formatNumber,
  formatVolume,
  sortNewestFirst,
  StageFocusActions,
  StatusTile
} from "./StagePanelShared";
import { useTranslation } from "react-i18next";

function fmtAbv(value?: number | null, locale?: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return "-";
  return `${formatNumber(value, 2, locale, "-")}%`;
}

function getLatestPackaging(ctx: StagePanelProps["ctx"]) {
  return (
    sortNewestFirst(
      ctx.brew.entries.filter(
        (entry) => entry.type === BREW_ENTRY_TYPE.PACKAGING
      )
    )[0] ?? null
  );
}

function getPackageCount(data?: BrewPackagingData | null) {
  return (data?.bottleRows ?? []).reduce((sum, row) => sum + row.quantity, 0);
}

function getCompletionDate(ctx: StagePanelProps["ctx"]) {
  const completionEntry = sortNewestFirst(
    ctx.brew.entries.filter(
      (entry) =>
        entry.type === BREW_ENTRY_TYPE.STAGE_CHANGE &&
        (entry.data as any)?.to === "COMPLETE"
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

  return sortNewestFirst(
    ctx.brew.entries.filter((entry) => entry.type === BREW_ENTRY_TYPE.NOTE)
  ).slice(0, 3);
}

export function CompleteStagePanel({
  t,
  status,
  ctx,
  helpers,
  readOnly = false
}: StagePanelProps) {
  const { i18n } = useTranslation();
  const unit =
    ctx.recipe.recipeData?.unitDefaults.volume ??
    ctx.recipe.derived?.volume.unit ??
    "gal";
  const locale = i18n.resolvedLanguage;
  const latestPackaging = getLatestPackaging(ctx);
  const latestPackagingData = latestPackaging?.data as
    | BrewPackagingData
    | null
    | undefined;
  const packagedVolume = latestPackagingData?.packagedVolumeLiters ?? null;
  const packageCount = getPackageCount(latestPackagingData);
  const originalGravity = ctx.recipe.actual.originalGravity?.gravity ?? null;
  const finalGravity = ctx.recipe.actual.finalGravity?.gravity ?? null;
  const latestGravity =
    ctx.recipe.actual.latestGravity ??
    ctx.brew.latest_gravity ??
    ctx.brew.effective_latest_gravity ??
    null;
  const hasTastings = ctx.brew.entries.some(
    (entry) => entry.type === BREW_ENTRY_TYPE.TASTING
  );
  const abv =
    typeof ctx.recipe.actual.currentAbv === "number" &&
    Number.isFinite(ctx.recipe.actual.currentAbv)
      ? ctx.recipe.actual.currentAbv
      : typeof originalGravity === "number" &&
          Number.isFinite(originalGravity) &&
          typeof finalGravity === "number" &&
          Number.isFinite(finalGravity)
        ? calcABV(originalGravity, finalGravity)
        : null;
  const finalNotes = getFinalNotes(ctx);
  const canAddEntry = status === "current" && !readOnly;

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
          value={fmtAbv(abv, locale)}
          tone={abv != null ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.complete.packagedVolume", "Packaged volume")}
          value={formatVolume(packagedVolume, unit, locale, { fallback: "-" })}
          tone={packagedVolume ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.packaged.packageCount", "Package count")}
          value={
            packageCount > 0 ? formatNumber(packageCount, 0, locale, "-") : "-"
          }
          tone={packageCount > 0 ? "ok" : "warn"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatusTile
          label={t("brews.complete.originalGravity", "Original gravity")}
          value={formatGravity(originalGravity, locale, "-")}
          tone={originalGravity ? "ok" : "warn"}
        />
        <StatusTile
          label={t("brews.complete.finalGravity", "Final gravity")}
          value={formatGravity(finalGravity, locale, "-")}
          tone={finalGravity ? "ok" : "warn"}
        />
        <StatusTile
          label={t("iSpindelDashboard.brews.latestGrav", "Latest gravity")}
          value={formatGravity(latestGravity, locale, "-")}
          tone={latestGravity ? "ok" : "warn"}
        />
      </div>

      <div className="rounded-md border border-border bg-background/40 px-3 py-3 text-sm">
        <div className="font-medium">
          {t("brews.complete.packagingRecap", "Packaging recap")}
        </div>
        <div className="mt-1 text-muted-foreground">
          {formatVolume(
            latestPackagingData?.packagedVolumeLiters,
            unit,
            locale,
            { fallback: "-" }
          )}
          {packageCount > 0
            ? ` - ${formatNumber(packageCount, 0, locale, "-")} ${t("brews.packaged.packages", "packages")}`
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
                  {formatNumber(row.quantity, 0, locale, "-")} {row.label}
                </span>
                {row.totalLiters > 0 ? (
                  <span className="text-muted-foreground">
                    {formatVolume(row.totalLiters, unit, locale, {
                      fallback: "-"
                    })}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
        {latestPackaging?.note ? (
          <div className="mt-3 whitespace-pre-line">{latestPackaging.note}</div>
        ) : null}
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
              <div
                key={entry.id}
                className="border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-sm font-medium">
                    {entry.title ||
                      (entry.type === BREW_ENTRY_TYPE.TASTING
                        ? t("tasting", "Tasting")
                        : t("note", "Note"))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(entry.datetime ?? entry.createdAt)}
                  </div>
                </div>
                {entry.note ? (
                  <div className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {entry.note}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">
            {t(
              "brews.complete.noFinalNotes",
              "No tastings or notes recorded yet."
            )}
          </div>
        )}
      </div>

      {canAddEntry ? (
        <StageFocusActions
          title={t("brews.actions.addEntry", "Add entry")}
          description={t(
            "brews.complete.addEntryHint",
            "Add any final reading, tasting, issue, or note."
          )}
        >
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
        </StageFocusActions>
      ) : null}
    </div>
  );
}
