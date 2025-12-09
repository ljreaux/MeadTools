import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltips";
import { Recipe } from "@/types/recipeDataTypes";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";
import { normalizeNumberString } from "@/lib/utils/validateInput";
import InputWithUnits from "../nutrientCalc/InputWithUnits";

function Results({ useRecipe }: { useRecipe: () => Recipe }) {
  const {
    OG,
    FG,
    updateFG,
    backsweetenedFG,
    totalVolume,
    volume,
    ABV,
    delle,
    units
  } = useRecipe();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const backgroundColor = {
    warning: "bg-[rgb(255,204,0)] text-black",
    destructive: "bg-destructive",
    default: "p-0"
  };

  const ogWarningClass: keyof typeof backgroundColor =
    OG > 1.16 ? "destructive" : OG > 1.125 ? "warning" : "default";

  const abvWarningClass: keyof typeof backgroundColor =
    ABV > 23 ? "destructive" : ABV > 20 ? "warning" : "default";

  if (totalVolume <= 0 || OG <= 1) return null;

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
          {normalizeNumberString(OG, 3, locale)}
        </p>
      </label>

      {/* Est. FG (editable) */}
      <label>
        <span className="items-center flex gap-1">
          {t("recipeBuilder.resultsLabels.estFG")}
          <Tooltip body={t("tipText.estimatedFg")} />
        </span>
        <InputWithUnits
          value={FG}
          handleChange={(e) => updateFG(e.target.value)}
          text={t("SG")}
        />
      </label>

      {/* Backsweetened FG */}
      <label>
        <span>{t("recipeBuilder.resultsLabels.backFG")}</span>
        <p className="text-2xl font-medium tracking-tight">
          {normalizeNumberString(backsweetenedFG, 3, locale)}
        </p>
      </label>

      {/* Total primary volume */}
      <label>
        <span className="flex items-center gap-1">
          {t("recipeBuilder.resultsLabels.totalPrimary")}
          <Tooltip body={t("tipText.totalVolume")} />
        </span>
        <p className="text-2xl font-medium tracking-tight">
          {normalizeNumberString(Number(volume), 3, locale)}
          <span className="text-muted-foreground text-lg ml-1">
            {units.volume}
          </span>
        </p>
      </label>

      {/* Total secondary volume */}
      <label>
        <span className="flex items-center gap-1">
          {t("recipeBuilder.resultsLabels.totalSecondary")}
          <Tooltip body={t("tipText.totalSecondary")} />
        </span>
        <p className="text-2xl font-medium tracking-tight">
          {normalizeNumberString(totalVolume, 3, locale)}
          <span className="text-muted-foreground text-lg ml-1">
            {units.volume}
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
          {normalizeNumberString(ABV, 2, locale)}
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
          {normalizeNumberString(delle, 0, locale)}
          <span className="text-muted-foreground text-lg ml-1">{t("DU")}</span>
        </p>
      </label>

      <Separator className="col-span-full" />
    </div>
  );
}

export default Results;
