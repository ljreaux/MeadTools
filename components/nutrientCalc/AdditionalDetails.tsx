"use client";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";

import Tooltip from "../Tooltips";
import InputWithUnits from "./InputWithUnits";
import { normalizeNumberString } from "@/lib/utils/validateInput";
import { useNutrients } from "@/components/providers/NutrientProvider"; // adjust import path

const gfOptions = [
  { value: "Go-Ferm", label: "nuteResults.gfTypes.gf" },
  { value: "protect", label: "nuteResults.gfTypes.gfProtect" },
  { value: "sterol-flash", label: "nuteResults.gfTypes.gfSterol" },
  { value: "none", label: "nuteResults.gfTypes.none" }
] as const;

const goFermKeys: Record<string, string> = {
  "Go-Ferm": "nuteResults.gfTypes.gf",
  protect: "nuteResults.gfTypes.gfProtect",
  "sterol-flash": "nuteResults.gfTypes.gfSterol",
  none: "nuteResults.gfTypes.none"
};

export default function AdditionalDetails() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const { data, derived, actions } = useNutrients();

  const goFermType = data.inputs.goFermType;
  const yeastAmount = data.inputs.yeastAmountG;
  const yeastTouched = data.inputs.yeastAmountTouched;

  const goFermLabel = t(goFermKeys[goFermType] ?? goFermType);

  return (
    <div className="joyride-goFerm flex flex-col gap-4">
      <h3 className="text-base font-semibold">{t("gfDetails")}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Yeast amount */}
        <label className="grid gap-1">
          <span className="flex items-center sm:gap-1 text-sm font-medium">
            {t("yeastAmount")}
            <Tooltip body={t("tipText.yeastAmount")} />
          </span>

          <div className="flex gap-2">
            <InputWithUnits
              value={yeastAmount}
              text="g"
              handleChange={(e) => actions.setYeastAmountG(e.target.value)}
            />
            {yeastTouched && (
              <button
                type="button"
                className="h-12 px-3 rounded-md border text-sm hover:bg-accent"
                onClick={actions.resetYeastAmountAuto}
                title={t("tipText.yeastAmountAuto")}
              >
                {t("auto")}
              </button>
            )}
          </div>
        </label>

        {/* Go-Ferm type */}
        <label className="grid gap-1">
          <span className="flex items-center sm:gap-1 text-sm font-medium">
            {t("goFermType")}
            <Tooltip body={t("tipText.goFerm")} />
          </span>

          <Select onValueChange={actions.setGoFermType} value={goFermType}>
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gfOptions.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {t(label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {/* Only show details if a Go-Ferm type is selected */}
      {goFermType !== "none" && (
        <div className="flex flex-col gap-3 py-2">
          <div className="flex items-center rounded-md p-2">
            {/* Left – Go-Ferm amount */}
            <div className="flex-1 flex justify-end">
              <div className="text-center mr-3">
                <p className="text-2xl font-medium tracking-tight">
                  {normalizeNumberString(derived.goFerm.amount, 2, locale)}
                  <span className="text-muted-foreground text-lg">g</span>
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
                  {goFermLabel}
                  <Tooltip body={t("tipText.goFerm")} />
                </p>
              </div>
            </div>

            <Separator orientation="vertical" className="h-8" />

            {/* Right – Water amount */}
            <div className="flex-1 flex justify-start">
              <div className="text-center ml-3">
                <p className="text-2xl font-medium tracking-tight">
                  {normalizeNumberString(derived.goFerm.water, 0, locale, true)}
                  <span className="text-muted-foreground text-lg">ml</span>
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
                  {t("water")}
                  <Tooltip body={t("tipText.goFermWater")} />
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
