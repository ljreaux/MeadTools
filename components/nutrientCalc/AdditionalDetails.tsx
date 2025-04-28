import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import InputWithUnits from "./InputWithUnits";
import Tooltip from "../Tooltips";
import { NutrientType } from "@/types/nutrientTypes";

const gfOptions = [
  { value: "Go-Ferm", label: "nuteResults.gfTypes.gf" },
  { value: "protect", label: "nuteResults.gfTypes.gfProtect" },
  { value: "sterol-flash", label: "nuteResults.gfTypes.gfSterol" },
  { value: "none", label: "nuteResults.gfTypes.none" },
];
function AdditionalDetails({
  useNutrients,
}: {
  useNutrients: () => NutrientType;
}) {
  const { t } = useTranslation();
  const { goFermType, yeastAmount, changeYeastAmount } = useNutrients();
  return (
    <div className="joyride-goFerm grid grid-cols-2 gap-2">
      <label className="grid gap-1">
        <span className="flex items-center gap-1">
          {t("yeastAmount")}
          <Tooltip body={t("tipText.yeastAmount")} />
        </span>
        <InputWithUnits
          value={yeastAmount}
          text="g"
          handleChange={changeYeastAmount}
        />
      </label>
      <label className="grid gap-1">
        <span className="flex items-center gap-1">
          {t("goFermType")}
          <Tooltip body={t("tipText.goFerm")} />
        </span>
        <Select onValueChange={goFermType.onChange} value={goFermType.value}>
          <SelectTrigger>
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
  );
}

export default AdditionalDetails;
