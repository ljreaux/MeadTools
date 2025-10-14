import React from "react";
import InputWithUnits from "./InputWithUnits";
import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltips";
import { NutrientType } from "@/types/nutrientTypes";
import { cn } from "@/lib/utils";

const goFermKeys = {
  "Go-Ferm": "nuteResults.gfTypes.gf",
  protect: "nuteResults.gfTypes.gfProtect",
  "sterol-flash": "nuteResults.gfTypes.gfSterol",
  none: "nuteResults.gfTypes.none"
};

function Results({ useNutrients }: { useNutrients: () => NutrientType }) {
  const { t } = useTranslation();
  const {
    nutrientAdditions,
    goFerm,
    goFermType,
    remainingYan,
    otherNutrientName,
    selected
  } = useNutrients();

  const labels = [
    "nutrients.fermO",
    "nutrients.fermK",
    "nutrients.dap",
    "other.label"
  ];

  const goFermLabel = t(goFermKeys[goFermType.value]) || t(goFermType.value);
  return (
    <div>
      <h2>{t("nuteAmounts")}</h2>
      <div className="joyride-nuteResults grid grid-cols-2 gap-2 border-b border-muted-foreground py-6">
        {nutrientAdditions.totalGrams.map((add, i) => {
          const perAdd = Math.max(nutrientAdditions.perAddition[i], 0);
          const shouldShow = selected.selectedNutrients.includes(t(labels[i]));
          if (!shouldShow) return null;

          const flag = add <= 0;

          return (
            <label
              key={labels[i]}
              className={cn("space-y-2 p-2", {
                "bg-[rgb(255,204,0)] text-black rounded-md": flag
              })}
            >
              <span className="flex items-center">
                {labels[i] !== "other.label"
                  ? t(labels[i])
                  : otherNutrientName.value}
                {flag && <Tooltip body={t("nutrientWarning")} />}
              </span>
              <InputWithUnits
                value={Math.max(add, 0).toFixed(3)}
                text="g total"
                disabled
              />
              <InputWithUnits value={perAdd.toFixed(3)} text="g" disabled />
            </label>
          );
        })}
        {Math.round(remainingYan) !== 0 && (
          <div className="joyride-warning col-span-2 bg-destructive p-2">
            <span className="flex gap-1 items-center">
              {t("nuteResults.sideLabels.remainingYan")}
              <Tooltip body={t("tipText.remainingYan")} />
            </span>{" "}
            <p>
              {remainingYan.toFixed(0)} {t("PPM")}
            </p>
          </div>
        )}
      </div>
      {goFermType.value !== "none" && (
        <div className="joyride-goFerm grid grid-cols-2 gap-2 py-6">
          <h3 className="col-span-2">{t("gfDetails")}</h3>
          <label className="col-start-1">
            {t("PDF.addAmount")}
            <p>{`${goFerm.amount}g ${goFermLabel}`}</p>
          </label>
          <label>
            {t("water")}
            <InputWithUnits value={goFerm.water} text="ml" disabled />
          </label>
        </div>
      )}
    </div>
  );
}

export default Results;
