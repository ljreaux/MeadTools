"use client";

import * as React from "react";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdditiveLine, IngredientLine } from "@/types/recipeData";
import type { NutrientKey } from "@/types/nutrientData";

import type { StagePanelProps } from "../stageConfig";

function fmtAmount(value?: string, unit?: string) {
  const v = (value ?? "").trim();
  if (!v) return null;
  return unit ? `${v} ${unit}` : v;
}

function fmtNumber(value?: number | null, decimals = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0
  }).format(value);
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

function buildIngredientList(ingredients: IngredientLine[]) {
  return ingredients
    .filter((line) => (line.name ?? "").trim().length > 0)
    .map((line) => ({
      key: line.lineId,
      ...ingredientDisplay(line)
    }));
}

function buildAdditiveList(additives: AdditiveLine[]) {
  return additives
    .filter((line) => (line.name ?? "").trim().length > 0)
    .map((line) => ({
      key: line.lineId,
      name: line.name.trim(),
      amount: fmtAmount(line.amount, line.unit)
    }));
}

const nutrientLabels: Record<NutrientKey, string> = {
  fermO: "Fermaid O",
  fermK: "Fermaid K",
  dap: "DAP",
  other: "Other"
};

function buildNutrientRows(
  plan: StagePanelProps["ctx"]["recipe"]["nutrientPlan"]
) {
  if (!plan) return [];

  const keys: NutrientKey[] = ["fermO", "fermK", "dap", "other"];

  return keys
    .map((key) => ({
      key,
      label:
        key === "other" && plan.effectiveData.settings.other.name.trim()
          ? plan.effectiveData.settings.other.name.trim()
          : nutrientLabels[key],
      total: plan.derived.nutrientAdditions.totalGrams[key],
      perAddition: plan.derived.nutrientAdditions.perAddition[key]
    }))
    .filter((row) => row.total > 0);
}

export function PlannedStagePanel({ t, ctx }: StagePanelProps) {
  const primaryList = React.useMemo(
    () => buildIngredientList(ctx.recipe.primaryIngredients),
    [ctx.recipe.primaryIngredients]
  );
  const secondaryList = React.useMemo(
    () => buildIngredientList(ctx.recipe.secondaryIngredients),
    [ctx.recipe.secondaryIngredients]
  );
  const additiveList = React.useMemo(
    () => buildAdditiveList(ctx.recipe.additives),
    [ctx.recipe.additives]
  );
  const nutrientRows = React.useMemo(
    () => buildNutrientRows(ctx.recipe.nutrientPlan),
    [ctx.recipe.nutrientPlan]
  );

  const hasRecipe = ctx.hasRecipeLinked && Boolean(ctx.recipe.snapshot);
  const yeast = ctx.recipe.yeast;
  const nutrientPlan = ctx.recipe.nutrientPlan;
  const stabilizerPlan = ctx.recipe.stabilizerPlan;
  const primaryPrepCardCount = [
    yeast,
    nutrientPlan,
    stabilizerPlan?.enabled
  ].filter(Boolean).length;
  const stabilizerSpansFull =
    Boolean(stabilizerPlan?.enabled) && primaryPrepCardCount % 2 === 1;

  return (
    <div className="space-y-5">
      {!hasRecipe ? (
        <section className="rounded-md border border-border bg-background/40 p-3 space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">
              {t("brews.planned.linkRecipeTitle", "Link a recipe")}
            </div>
            <div className="text-sm text-muted-foreground">
              {t(
                "brews.planned.linkRecipeRequiredHelp",
                "Brew tracking needs a linked recipe before primary can start."
              )}
            </div>
          </div>
          <Button asChild size="sm">
            <Link href={`/account/brews/${ctx.brew.id}/link`}>
              {t("brews.planned.linkRecipeAction", "Link recipe")}
            </Link>
          </Button>
        </section>
      ) : null}

      <IngredientList
        t={t}
        title={t("brews.planned.grabList", "What to grab for primary")}
        empty={
          hasRecipe
            ? t(
                "brews.planned.noGrabItems",
                "No primary ingredients found in the linked recipe."
              )
            : t(
                "brews.planned.noManualGrabItems",
                "No planned ingredients are available until a recipe is linked."
              )
        }
        items={primaryList}
      />

      {hasRecipe && (yeast || nutrientPlan || stabilizerPlan?.enabled) ? (
        <section className="grid gap-3 md:grid-cols-2">
          {yeast ? (
            <InfoBlock
              icon={<FlaskConical className="h-4 w-4" />}
              title={t("brews.planned.yeast", "Yeast")}
              rows={[
                {
                  label: t("yeastStrain", "Strain"),
                  value:
                    [yeast.brand, yeast.strain].filter(Boolean).join(" ") ||
                    "—"
                },
                {
                  label: t("brews.planned.yeastAmount", "Amount"),
                  value:
                    typeof yeast.plannedAmountG === "number"
                      ? `${fmtNumber(yeast.plannedAmountG)} g`
                      : "—"
                },
                {
                  label: t("Go-Ferm", "Go-Ferm"),
                  value:
                    nutrientPlan && nutrientPlan.derived.goFerm.amount > 0
                      ? `${fmtNumber(nutrientPlan.derived.goFerm.amount)} g`
                      : t("none", "None")
                },
                {
                  label: t("brews.planned.goFermWater", "Go-Ferm water"),
                  value:
                    nutrientPlan && nutrientPlan.derived.goFerm.water > 0
                      ? `${fmtNumber(nutrientPlan.derived.goFerm.water)} mL`
                      : t("none", "None")
                }
              ]}
            />
          ) : null}

          {nutrientPlan ? (
            <InfoBlock
              title={t("brews.planned.nutrients", "Nutrients")}
              rows={[
                {
                  label: t("nuteLabels.targetYAN", "Target YAN"),
                  value: `${fmtNumber(nutrientPlan.derived.targetYanPpm, 0)} ppm`
                },
                {
                  label: t("brews.planned.additions", "Additions"),
                  value: String(nutrientPlan.derived.numberOfAdditions)
                },
                ...nutrientRows.map((row) => ({
                  label: row.label,
                  value: `${fmtNumber(row.total)} g total / ${fmtNumber(
                    row.perAddition
                  )} g each`
                }))
              ]}
            />
          ) : null}

          {stabilizerPlan?.enabled ? (
            <InfoBlock
              className={stabilizerSpansFull ? "md:col-span-2" : undefined}
              title={t("stabilizers.label", "Stabilizers")}
              rows={[
                {
                  label: t("type", "Type"),
                  value:
                    stabilizerPlan.type === "kmeta"
                      ? t("kMeta", "K-Meta")
                      : t("naMeta", "Na-Meta")
                },
                {
                  label: t("pH", "pH"),
                  value: stabilizerPlan.takingPh
                    ? stabilizerPlan.phReading || "—"
                    : t("brews.planned.phNotTracked", "Not tracked")
                },
                {
                  label:
                    stabilizerPlan.type === "kmeta"
                      ? t("kMeta", "K-Meta")
                      : t("naMeta", "Na-Meta"),
                  value: `${fmtNumber(stabilizerPlan.derived.sulfite, 3)} g ${t(
                    "accountPage.or",
                    "or"
                  )} ${fmtNumber(stabilizerPlan.derived.campden, 2)} ${t(
                    "campden",
                    "Campden Tablets"
                  )}`
                },
                {
                  label: t("sorbate", "Sorbate"),
                  value: `${fmtNumber(stabilizerPlan.derived.sorbate)} g`
                }
              ]}
            />
          ) : null}
        </section>
      ) : null}

      {hasRecipe && (additiveList.length > 0 || secondaryList.length > 0) ? (
        <section className="grid gap-3 md:grid-cols-2">
          {additiveList.length > 0 ? (
            <AdditiveList
              title={t("brews.planned.additives", "Additives")}
              items={additiveList}
            />
          ) : null}

          {secondaryList.length > 0 ? (
            <IngredientList
              t={t}
              title={t("brews.planned.secondaryIngredients", "Secondary ingredients")}
              empty=""
              items={secondaryList}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function IngredientList({
  t,
  title,
  empty,
  items
}: {
  t: StagePanelProps["t"];
  title: string;
  empty: string;
  items: ReturnType<typeof buildIngredientList>;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>

      {items.length ? (
        <ul className="space-y-1">
          {items.map((item) => (
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
                  <div className="mt-0.5 text-xs text-muted-foreground">
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
        <div className="text-sm text-muted-foreground">{empty}</div>
      )}
    </div>
  );
}

function AdditiveList({
  title,
  items
}: {
  title: string;
  items: ReturnType<typeof buildAdditiveList>;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-start justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2"
          >
            <div className="text-sm font-medium leading-tight">
              {item.name}
            </div>
            <div className="shrink-0 text-sm text-muted-foreground">
              {item.amount ?? "—"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfoBlock({
  className,
  icon,
  title,
  rows
}: {
  className?: string;
  icon?: React.ReactNode;
  title: string;
  rows: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div className={cn("rounded-md border border-border bg-background/40 p-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <dl className="mt-3 space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-right font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
