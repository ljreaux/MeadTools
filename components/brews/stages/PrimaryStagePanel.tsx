"use client";

import * as React from "react";
import type { IngredientLine } from "@/types/recipeData";
import type { StagePanelProps } from "../stageConfig";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import type { BrewAdditionData } from "@/lib/utils/entryPayload";
import { Button } from "@/components/ui/button";
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
    line.amounts.basis === "volume" ? volume ?? weight : weight ?? volume;

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

  console.log(primaryLines);

  const loggedIds = React.useMemo(
    () => getLoggedRecipeIds(ctx.brew.entries),
    [ctx.brew.entries]
  );

  const missing = React.useMemo(() => {
    return primaryLines.filter((x) => !loggedIds.has(String(x.line.lineId)));
  }, [primaryLines, loggedIds]);

  const doneCount = primaryLines.length - missing.length;

  const canEdit = status === "current"; // you can loosen this if you want

  return (
    <div className="space-y-4">
      {/* Quick entry buttons (non-addition) */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={!canEdit}
          onClick={() =>
            helpers.openAddEntry?.({
              presetType: BREW_ENTRY_TYPE.GRAVITY,
              allowedTypes: [BREW_ENTRY_TYPE.GRAVITY]
            })
          }
        >
          {t("brews.actions.addGravity", "Add gravity")}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          disabled={!canEdit}
          onClick={() =>
            helpers.openAddEntry?.({
              presetType: BREW_ENTRY_TYPE.TEMPERATURE,
              allowedTypes: [BREW_ENTRY_TYPE.TEMPERATURE]
            })
          }
        >
          {t("brews.actions.addTemp", "Add temperature")}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          disabled={!canEdit}
          onClick={() =>
            helpers.openAddEntry?.({
              presetType: BREW_ENTRY_TYPE.PH,
              allowedTypes: [BREW_ENTRY_TYPE.PH]
            })
          }
        >
          {t("brews.actions.addPh", "Add pH")}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          disabled={!canEdit}
          onClick={() =>
            helpers.openAddEntry?.({
              allowedTypes: [
                BREW_ENTRY_TYPE.NOTE,
                BREW_ENTRY_TYPE.TASTING,
                BREW_ENTRY_TYPE.ISSUE
              ]
            })
          }
        >
          {t("brews.actions.addNote", "Add note/tasting/issue")}
        </Button>
      </div>

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

                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t("brews.primary.recipeLineId", "Recipe line")}:{" "}
                    {String(x.line.lineId)}
                  </div>
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
