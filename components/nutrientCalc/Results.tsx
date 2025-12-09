import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltips";
import { NutrientType } from "@/types/nutrientTypes";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";
import { normalizeNumberString } from "@/lib/utils/validateInput";

function Results({ useNutrients }: { useNutrients: () => NutrientType }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const {
    nutrientAdditions,
    remainingYan,
    otherNutrientName,
    selected,
    targetYAN
  } = useNutrients();

  const labels = [
    "nutrients.fermO",
    "nutrients.fermK",
    "nutrients.dap",
    "other.label"
  ];

  return (
    <div>
      <h2>{t("nuteAmounts")}</h2>
      <div className="joyride-nuteResults grid grid-cols-2 gap-4">
        {nutrientAdditions.totalGrams.map((add, i) => {
          const perAdd = Math.max(nutrientAdditions.perAddition[i], 0);
          const shouldShow = selected.selectedNutrients.includes(t(labels[i]));
          if (!shouldShow) return null;

          const flag = add <= 0;

          return (
            <label
              key={labels[i]}
              className={cn("space-y-2 my-2", {
                "text-warning": flag
              })}
            >
              <span className="flex">
                {labels[i] !== "other.label"
                  ? t(labels[i])
                  : otherNutrientName.value}
                {flag && <Tooltip body={t("nutrientWarning")} />}
              </span>
              <div className="flex">
                <div className="text-center mr-3">
                  <p className="text-2xl font-medium tracking-tight">
                    {normalizeNumberString(add, 3, locale)}
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
              {normalizeNumberString(targetYAN, 0, locale, true)}
              <span className="text-muted-foreground text-lg">{t("PPM")}</span>
            </p>
          </div>
          {Math.round(remainingYan) !== 0 && (
            <div className="joyride-warning rounded-md bg-destructive p-2 flex-1">
              <span className="flex gap-1 items-center">
                {t("nuteResults.sideLabels.remainingYan")}
                <Tooltip body={t("tipText.remainingYan")} />
              </span>
              <p className="text-2xl font-medium tracking-tight">
                {normalizeNumberString(remainingYan, 0, locale, true)}
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
