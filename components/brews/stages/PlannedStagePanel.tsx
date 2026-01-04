"use client";

import * as React from "react";
import type { IngredientLine } from "@/types/recipeData";
import type { StagePanelProps } from "../stageConfig";
import { cn } from "@/lib/utils";

function fmtAmount(value?: string, unit?: string) {
  const v = (value ?? "").trim();
  if (!v) return null;
  return unit ? `${v} ${unit}` : v;
}

// What the user needs to grab: primary ingredients (usually excluding water)
function buildGrabList(ingredients: IngredientLine[]) {
  return ingredients
    .filter((l) => !l.secondary)
    .map((l) => {
      const name = (l.name ?? "").trim() || "—";

      const weight = fmtAmount(l.amounts.weight.value, l.amounts.weight.unit);
      const volume = fmtAmount(l.amounts.volume.value, l.amounts.volume.unit);

      // Prefer the basis as the “main” display, show the other as a hint if present
      const primary =
        l.amounts.basis === "volume" ? volume ?? weight : weight ?? volume;

      const secondary =
        l.amounts.basis === "volume"
          ? weight && weight !== primary
            ? weight
            : null
          : volume && volume !== primary
          ? volume
          : null;

      return {
        key: l.lineId, // ✅ stable + unique
        name,
        primary,
        secondary
      };
    })
    .filter((x) => x.name !== "—"); // optional: drop unnamed lines
}

export function PlannedStagePanel({ t, ctx }: StagePanelProps) {
  const grabList = React.useMemo(
    () => buildGrabList(ctx.recipe.ingredients),
    [ctx.recipe.ingredients]
  );

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">
        {t("brews.planned.grabList", "What to grab")}
      </div>

      {grabList.length ? (
        <ul className="space-y-1">
          {grabList.map((item) => (
            <li
              key={item.key}
              className={cn(
                "flex items-start justify-between gap-3",
                "rounded-md border border-border bg-background/40 px-3 py-2"
              )}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium leading-tight line-clamp-1">
                  {item.name}
                </div>
                {item.secondary ? (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t("brews.planned.altAmount", "Alt")}: {item.secondary}
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 text-sm text-muted-foreground">
                {item.primary ?? "—"}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-muted-foreground">
          {t(
            "brews.planned.noGrabItems",
            "No primary ingredients found in the linked recipe."
          )}
        </div>
      )}
    </div>
  );
}
