"use client";

import * as React from "react";
import type { IngredientLine } from "@/types/recipeData";
import type { StagePanelProps } from "../stageConfig";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import type { BrewAdditionData } from "@/lib/utils/entryPayload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function fmtAmount(value?: string, unit?: string) {
  const v = (value ?? "").trim();
  if (!v) return null;
  return unit ? `${v} ${unit}` : v;
}
function getRecipeAmount(line: IngredientLine) {
  const basis = line.amounts.basis;

  const src = basis === "volume" ? line.amounts.volume : line.amounts.weight;

  const amount = Number(src.value);

  if (!Number.isFinite(amount)) return {};

  return {
    amount,
    unit: src.unit
  };
}

function ingredientDisplay(line: IngredientLine) {
  const name = (line.name ?? "").trim() || "—";

  const weight = fmtAmount(line.amounts.weight.value, line.amounts.weight.unit);
  const volume = fmtAmount(line.amounts.volume.value, line.amounts.volume.unit);

  const primary =
    line.amounts.basis === "volume" ? (volume ?? weight) : (weight ?? volume);

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

function getLoggedRecipeIds(
  entries: StagePanelProps["ctx"]["brew"]["entries"]
) {
  const ids = new Set<string>();

  for (const e of entries) {
    if (e.type !== BREW_ENTRY_TYPE.ADDITION) continue;
    const d = e.data as Partial<BrewAdditionData> | null | undefined;
    const rid = d?.recipeIngredientId;
    if (rid) ids.add(String(rid));
  }

  return ids;
}

function buildPrimaryLines(lines: IngredientLine[]) {
  return lines
    .filter((l) => !l.secondary)
    .filter((l) => (l.name ?? "").trim().length > 0)
    .map((l) => ({ line: l, ...ingredientDisplay(l) }));
}

function toLiters(value: number, unit: "gal" | "qt" | "pt" | "L" | "mL") {
  switch (unit) {
    case "gal":
      return value * 3.785411784;
    case "qt":
      return value * 0.946352946;
    case "pt":
      return value * 0.473176473;
    case "mL":
      return value / 1000;
    case "L":
    default:
      return value;
  }
}

function formatDisplayVolume(liters: number | null | undefined) {
  if (typeof liters !== "number" || !Number.isFinite(liters) || liters <= 0) {
    return null;
  }

  return `${liters.toFixed(2)} L`;
}

export function PrimaryStagePanel({
  t,
  status,
  ctx,
  helpers
}: StagePanelProps) {
  const primaryLines = React.useMemo(
    () => buildPrimaryLines(ctx.recipe.ingredients),
    [ctx.recipe.ingredients]
  );

  const loggedIds = React.useMemo(
    () => getLoggedRecipeIds(ctx.brew.entries),
    [ctx.brew.entries]
  );

  const missing = React.useMemo(() => {
    return primaryLines.filter((x) => !loggedIds.has(String(x.line.lineId)));
  }, [primaryLines, loggedIds]);

  const doneCount = primaryLines.length - missing.length;

  const canEdit = status === "current"; // you can loosen this if you want

  const [volumeDialogOpen, setVolumeDialogOpen] = React.useState(false);
  const [volumeValue, setVolumeValue] = React.useState("");
  const [volumeUnit, setVolumeUnit] = React.useState<
    "gal" | "qt" | "pt" | "L" | "mL"
  >("gal");
  const [isSavingVolume, setIsSavingVolume] = React.useState(false);

  const currentVolumeDisplay = React.useMemo(
    () => formatDisplayVolume(ctx.brew.current_volume_liters),
    [ctx.brew.current_volume_liters]
  );

  const setPrimaryVolume = async () => {
    const parsed = Number(volumeValue);

    if (!Number.isFinite(parsed) || parsed <= 0) return;

    setIsSavingVolume(true);

    try {
      await helpers.patchBrewMetadata({
        current_volume_liters: toLiters(parsed, volumeUnit)
      });
      setVolumeDialogOpen(false);
    } finally {
      setIsSavingVolume(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dialog open={volumeDialogOpen} onOpenChange={setVolumeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("brews.primary.setVolume", "Record current volume")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "brews.primary.setVolumeDesc",
                "Record the current batch volume before moving to secondary."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {t("brews.primary.currentVolume", "Current volume")}
              </div>
              <div className="text-sm text-muted-foreground">
                {currentVolumeDisplay ??
                  t("brews.primary.noVolume", "No volume recorded yet.")}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">
                {t("brews.primary.enterVolume", "Volume")}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  inputMode="decimal"
                  value={volumeValue}
                  onChange={(e) => setVolumeValue(e.target.value)}
                  placeholder={t(
                    "brews.primary.volumePlaceholder",
                    "Enter volume"
                  )}
                  disabled={isSavingVolume}
                />

                <Select
                  value={volumeUnit}
                  onValueChange={(value) =>
                    setVolumeUnit(value as "gal" | "qt" | "pt" | "L" | "mL")
                  }
                  disabled={isSavingVolume}
                >
                  <SelectTrigger className="sm:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gal">{t("units.gal", "gal")}</SelectItem>
                    <SelectItem value="qt">{t("units.qt", "qt")}</SelectItem>
                    <SelectItem value="pt">{t("units.pt", "pt")}</SelectItem>
                    <SelectItem value="L">{t("units.L", "L")}</SelectItem>
                    <SelectItem value="mL">{t("units.mL", "mL")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setVolumeDialogOpen(false)}
              disabled={isSavingVolume}
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={setPrimaryVolume}
              disabled={
                !canEdit ||
                isSavingVolume ||
                !Number.isFinite(Number(volumeValue)) ||
                Number(volumeValue) <= 0
              }
            >
              {t("save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Quick entry buttons (non-addition) */}

      <Button
        size="sm"
        variant="secondary"
        disabled={!canEdit}
        onClick={() => {
          setVolumeValue("");
          setVolumeUnit("gal");
          setVolumeDialogOpen(true);
        }}
      >
        {t("brews.actions.logVolume", "Log volume")}
      </Button>

      {/* Ingredient checklist */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">
          {t("brews.primary.ingredients", "Primary ingredients")}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            {t("brews.primary.loggedCount", "Logged")} {doneCount}/
            {primaryLines.length}
          </div>

          <Button
            size="sm"
            disabled={!canEdit || missing.length === 0}
            onClick={async () => {
              // bulk-log *missing only*
              await helpers.addAdditions(
                missing.map((x) => {
                  const { amount, unit } = getRecipeAmount(x.line);

                  return {
                    name: x.name,
                    amount,
                    unit,
                    recipeIngredientId: String(x.line.lineId)
                  };
                })
              );
            }}
          >
            {t("brews.primary.logMissing", "Log missing")}
          </Button>
        </div>
      </div>

      {primaryLines.length ? (
        <ul className="space-y-1">
          {primaryLines.map((x) => {
            const isLogged = loggedIds.has(String(x.line.lineId));

            return (
              <li
                key={x.line.lineId}
                className={cn(
                  "flex items-start justify-between gap-3",
                  "rounded-md border border-border bg-background/40 px-3 py-2",
                  isLogged && "opacity-70"
                )}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight line-clamp-1">
                    {x.name}
                  </div>

                  {x.secondary ? (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t("brews.planned.altAmount", "Alt")}: {x.secondary}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <div className="text-sm text-muted-foreground">
                    {x.primary ?? "—"}
                  </div>

                  {isLogged ? (
                    <div className="text-xs text-muted-foreground">
                      {t("brews.primary.logged", "Logged")}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canEdit}
                      onClick={async () => {
                        const { amount, unit } = getRecipeAmount(x.line);

                        await helpers.addAddition({
                          name: x.name,
                          amount,
                          unit,
                          recipeIngredientId: String(x.line.lineId)
                        });
                      }}
                    >
                      {t("brews.primary.log", "Log")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-sm text-muted-foreground">
          {t(
            "brews.primary.noPrimaryIngredients",
            "No primary ingredients found in the linked recipe."
          )}
        </div>
      )}
    </div>
  );
}
