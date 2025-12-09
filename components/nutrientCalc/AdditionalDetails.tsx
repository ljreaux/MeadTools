import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltips";
import { NutrientType } from "@/types/nutrientTypes";
import InputWithUnits from "./InputWithUnits";
import { Separator } from "@/components/ui/separator";
import { normalizeNumberString } from "@/lib/utils/validateInput";

const gfOptions = [
  { value: "Go-Ferm", label: "nuteResults.gfTypes.gf" },
  { value: "protect", label: "nuteResults.gfTypes.gfProtect" },
  { value: "sterol-flash", label: "nuteResults.gfTypes.gfSterol" },
  { value: "none", label: "nuteResults.gfTypes.none" }
];

const goFermKeys: Record<string, string> = {
  "Go-Ferm": "nuteResults.gfTypes.gf",
  protect: "nuteResults.gfTypes.gfProtect",
  "sterol-flash": "nuteResults.gfTypes.gfSterol",
  none: "nuteResults.gfTypes.none"
};

function AdditionalDetails({
  useNutrients
}: {
  useNutrients: () => NutrientType;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { goFermType, yeastAmount, changeYeastAmount, goFerm } = useNutrients();

  const goFermLabel =
    t(goFermKeys[goFermType.value]) || t(goFermType.value || "Go-Ferm");

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
          <InputWithUnits
            value={yeastAmount}
            text="g"
            handleChange={changeYeastAmount}
          />
        </label>

        {/* Go-Ferm type */}
        <label className="grid gap-1">
          <span className="flex items-center sm:gap-1 text-sm font-medium">
            {t("goFermType")}
            <Tooltip body={t("tipText.goFerm")} />
          </span>
          <Select onValueChange={goFermType.onChange} value={goFermType.value}>
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
      {goFermType.value !== "none" && (
        <>
          {/* Centered Go-Ferm / Water results, similar to AbvLine */}
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center rounded-md p-2">
              {/* Left side – Go-Ferm amount */}
              <div className="flex-1 flex justify-end">
                <div className="text-center mr-3">
                  <p className="text-2xl font-medium tracking-tight">
                    {normalizeNumberString(goFerm.amount, 2, locale)}
                    <span className="text-muted-foreground text-lg">g</span>
                  </p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
                    {goFermLabel}
                    <Tooltip body={t("tipText.goFerm")} />
                  </p>
                </div>
              </div>

              {/* Center vertical separator */}
              <Separator orientation="vertical" className="h-8" />

              {/* Right side – Water amount */}
              <div className="flex-1 flex justify-start">
                <div className="text-center ml-3">
                  <p className="text-2xl font-medium tracking-tight">
                    {normalizeNumberString(goFerm.water, 0, locale, true)}
                    <span className="text-muted-foreground text-lg">ml</span>
                  </p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
                    {t("water")}
                    <Tooltip
                      body={t(
                        "tipText.goFermWater",
                        "Water amount for rehydration."
                      )}
                    />
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AdditionalDetails;
