import { Input } from "../ui/input";
import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltips";
import InputWithUnits from "../nutrientCalc/InputWithUnits";
import { Recipe } from "@/types/recipeDataTypes";
import { cn } from "@/lib/utils";

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
  const currentLocale = i18n.resolvedLanguage;
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
    <div className="joyride-recipeBuilderResults grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-muted-foreground py-6">
      <h3 className="col-span-full">{t("results")}</h3>
      <label
        className={cn("sm:col-span-2 p-4", backgroundColor[ogWarningClass])}
      >
        <span className="flex items-center">
          {t("recipeBuilder.resultsLabels.estOG")}{" "}
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
        <Input
          value={OG.toLocaleString(currentLocale, { maximumFractionDigits: 3 })}
          disabled
        />
      </label>
      <label>
        <span className="items-center flex">
          {t("recipeBuilder.resultsLabels.estFG")}
          <Tooltip body={t("tipText.estimatedFg")} />
        </span>
        <Input
          value={FG}
          onChange={(e) => updateFG(e.target.value)}
          inputMode="decimal"
          onFocus={(e) => e.target.select()}
        />
      </label>
      <label>
        {t("recipeBuilder.resultsLabels.backFG")}
        <Input
          disabled
          value={backsweetenedFG.toLocaleString(currentLocale, {
            maximumFractionDigits: 3
          })}
        />
      </label>
      <label>
        <span className="flex items-center gap-1">
          {t("recipeBuilder.resultsLabels.totalPrimary")}
          <Tooltip body={t("tipText.totalVolume")} />
        </span>
        <InputWithUnits disabled value={volume} text={units.volume} />
      </label>
      <label>
        <span className="flex items-center gap-1">
          {t("recipeBuilder.resultsLabels.totalSecondary")}
          <Tooltip body={t("tipText.totalSecondary")} />
        </span>
        <InputWithUnits
          disabled
          value={totalVolume.toLocaleString(currentLocale, {
            maximumFractionDigits: 3
          })}
          text={units.volume}
        />
      </label>
      <label
        className={cn(
          backgroundColor[abvWarningClass],
          abvWarningClass !== "default" && "p-2"
        )}
      >
        <span className="flex items-center">
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
        <InputWithUnits
          disabled
          value={ABV.toLocaleString(currentLocale, {
            maximumFractionDigits: 2
          })}
          text={t("recipeBuilder.percent")}
        />
      </label>
      <label>
        <span className="flex items-center gap-1">
          {t("recipeBuilder.resultsLabels.delle")}
          <Tooltip
            body={t("tipText.delleUnits")}
            link="https://wiki.meadtools.com/en/process/stabilization#via-yeast-alcohol-tolerance"
          />
        </span>
        <InputWithUnits disabled value={delle.toFixed()} text={t("DU")} />
      </label>
    </div>
  );
}

export default Results;
