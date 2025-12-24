"use client";

import { useTranslation } from "react-i18next";

import Tooltip from "../Tooltips";
import { Separator } from "../ui/separator";
import { cn } from "@/lib/utils";
import { normalizeNumberString } from "@/lib/utils/validateInput";

import { useNutrients } from "@/components/providers/NutrientProvider";
import type { NutrientKey } from "@/types/nutrientData";

function Results() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const { data, derived } = useNutrients();

  const labels: Record<NutrientKey, string> = {
    fermO: "nutrients.fermO",
    fermK: "nutrients.fermK",
    dap: "nutrients.dap",
    other: "other.label"
  };

  const keys: NutrientKey[] = ["fermO", "fermK", "dap", "other"];

  return (
    <div>
      <h2>{t("nuteAmounts")}</h2>

      <div className="joyride-nuteResults grid grid-cols-2 gap-4">
        {keys.map((key) => {
          const enabled = data.selected.selectedNutrients[key];
          if (!enabled) return null;

          const total = derived.nutrientAdditions.totalGrams[key] ?? 0;
          const perAdd = Math.max(
            derived.nutrientAdditions.perAddition[key] ?? 0,
            0
          );

          const flag = total <= 0;

          const label =
            key !== "other"
              ? t(labels[key])
              : data.settings.other.name || t(labels[key]);

          return (
            <label
              key={key}
              className={cn("space-y-2 my-2", {
                "text-warning": flag
              })}
            >
              <span className="flex">
                {label}
                {flag && <Tooltip body={t("nutrientWarning")} />}
              </span>

              <div className="flex">
                <div className="text-center mr-3">
                  <p className="text-2xl font-medium tracking-tight">
                    {normalizeNumberString(total, 3, locale)}
                    <span className="text-muted-foreground text-lg">
                      {t("G")}
                    </span>
                  </p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    total
                  </p>
                </div>

                <Separator orientation="vertical" className="h-8" />

                <div className="flex-1 flex justify-start">
                  <div className="text-center ml-3">
                    <p className="text-2xl font-medium tracking-tight">
                      {normalizeNumberString(perAdd, 3, locale)}
                      <span className="text-muted-foreground text-lg">
                        {t("G")}
                      </span>
                    </p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      per addition
                    </p>
                  </div>
                </div>
              </div>
            </label>
          );
        })}

        {/* Target / Remaining YAN row */}
        <div className="col-span-full flex gap-2 w-full py-4">
          <div className="grid gap-1 flex-1">
            <span className="flex gap-1 items-center">
              {t("targetYan")}
              <Tooltip body={t("tipText.yan")} />
            </span>

            <p className="text-2xl font-medium tracking-tight">
              {normalizeNumberString(derived.targetYanPpm, 0, locale, true)}
              <span className="text-muted-foreground text-lg">{t("PPM")}</span>
            </p>
          </div>

          {Math.round(derived.remainingYanPpm) !== 0 && (
            <div className="joyride-warning rounded-md bg-destructive p-2 flex-1">
              <span className="flex gap-1 items-center">
                {t("nuteResults.sideLabels.remainingYan")}
                <Tooltip body={t("tipText.remainingYan")} />
              </span>
              <p className="text-2xl font-medium tracking-tight">
                {normalizeNumberString(
                  derived.remainingYanPpm,
                  0,
                  locale,
                  true
                )}
                <span className="text-muted-foreground text-lg">
                  {t("PPM")}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Horizontal separator below the main nutrient results */}
        <Separator className="my-4 col-span-full" />
      </div>
    </div>
  );
}

export default Results;
