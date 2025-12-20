"use client";

import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltips";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";
import InputWithUnits from "../nutrientCalc/InputWithUnits";
import {
  normalizeNumberString,
  isValidNumber
} from "@/lib/utils/validateInput";
import { useRecipeV2 } from "@/components/providers/RecipeProviderV2";

export default function IngredientResultsV2() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const {
    data: { fg },
    setFg,
    derived: {
      ogPrimary,
      backsweetenedFg,
      primaryVolume,
      totalVolume,
      abv,
      delle,
      volumeUnit
    }
  } = useRecipeV2();

  const backgroundColor = {
    warning: "bg-[rgb(255,204,0)] text-black",
    destructive: "bg-destructive",
    default: "p-0"
  };

  const ogWarningClass: keyof typeof backgroundColor =
    ogPrimary > 1.16
      ? "destructive"
      : ogPrimary > 1.125
      ? "warning"
      : "default";

  const abvWarningClass: keyof typeof backgroundColor =
    abv > 23 ? "destructive" : abv > 20 ? "warning" : "default";

  // same gating as V1: hide until meaningful
  if (totalVolume <= 0 || ogPrimary <= 1) return null;

  return (
    <div className="joyride-recipeBuilderResults grid grid-cols-1 sm:grid-cols-2 gap-4">
      <h3 className="col-span-full">{t("results")}</h3>

      {/* Est. OG */}
      <label
        className={cn("sm:col-span-2 p-4", backgroundColor[ogWarningClass])}
      >
        <span className="flex items-center gap-1">
          {t("recipeBuilder.resultsLabels.estOG")}
          {ogWarningClass !== "default" && (
            <Tooltip
              body={t(
                ogWarningClass === "warning"
                  ? "tipText.ogWarning"
                  : "tipText.ogSeriousWarning"
              )}
            />
          )}
        </span>
        <p className="text-2xl font-medium tracking-tight">
          {normalizeNumberString(ogPrimary, 3, locale, true)}
        </p>
      </label>

      {/* Est. FG (editable) */}
      <label>
        <span className="items-center flex gap-1">
          {t("recipeBuilder.resultsLabels.estFG")}
          <Tooltip body={t("tipText.estimatedFg")} />
        </span>
        <InputWithUnits
          value={fg}
          handleChange={(e) => {
            const next = e.target.value;
            if (!isValidNumber(next)) return;
            setFg(next);
          }}
          text={t("SG")}
        />
      </label>

      {/* Backsweetened FG */}
      <label>
        <span>{t("recipeBuilder.resultsLabels.backFG")}</span>
        <p className="text-2xl font-medium tracking-tight">
          {normalizeNumberString(backsweetenedFg, 3, locale, true)}
        </p>
      </label>

      {/* Total primary volume */}
      <label>
        <span className="flex items-center gap-1">
          {t("recipeBuilder.resultsLabels.totalPrimary")}
          <Tooltip body={t("tipText.totalVolume")} />
        </span>
        <p className="text-2xl font-medium tracking-tight">
          {normalizeNumberString(primaryVolume, 3, locale)}
          <span className="text-muted-foreground text-lg ml-1">
            {volumeUnit}
          </span>
        </p>
      </label>

      {/* Total secondary volume (V1 label, but it’s actually total batch volume) */}
      <label>
        <span className="flex items-center gap-1">
          {t("recipeBuilder.resultsLabels.totalSecondary")}
          <Tooltip body={t("tipText.totalSecondary")} />
        </span>
        <p className="text-2xl font-medium tracking-tight">
          {normalizeNumberString(totalVolume, 3, locale)}
          <span className="text-muted-foreground text-lg ml-1">
            {volumeUnit}
          </span>
        </p>
      </label>

      {/* ABV */}
      <label
        className={cn(
          backgroundColor[abvWarningClass],
          abvWarningClass !== "default" && "p-2"
        )}
      >
        <span className="flex items-center gap-1">
          {t("recipeBuilder.resultsLabels.abv")}
          {abvWarningClass !== "default" && (
            <Tooltip
              body={t(
                abvWarningClass === "warning"
                  ? "tipText.abvWarning"
                  : "tipText.abvSeriousWarning"
              )}
            />
          )}
        </span>
        <p className="text-2xl font-medium tracking-tight">
          {normalizeNumberString(abv, 2, locale)}
          <span className="text-muted-foreground text-lg ml-1">
            {t("recipeBuilder.percent")}
          </span>
        </p>
      </label>

      {/* Delle units */}
      <label>
        <span className="flex items-center gap-1">
          {t("recipeBuilder.resultsLabels.delle")}
          <Tooltip
            body={t("tipText.delleUnits")}
            link="https://wiki.meadtools.com/en/process/stabilization#via-yeast-alcohol-tolerance"
          />
        </span>
        <p className="text-2xl font-medium tracking-tight">
          {normalizeNumberString(delle, 0, locale, true)}
          <span className="text-muted-foreground text-lg ml-1">{t("DU")}</span>
        </p>
      </label>

      <Separator className="col-span-full" />
    </div>
  );
}
