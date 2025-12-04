import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import InputWithUnits from "./InputWithUnits";
import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltips";
import { NutrientType } from "@/types/nutrientTypes";
import SearchableInput from "../ui/SearchableInput";

function YeastDetails({ useNutrients }: { useNutrients: () => NutrientType }) {
  const { t } = useTranslation();
  const {
    selected,
    setYeastBrand,
    yeastList,
    setYeastName,
    setNitrogenRequirement,
    targetYAN
  } = useNutrients();

  return (
    <div className="joyride-yeastDetails grid sm:grid-cols-2 gap-2 border-b border-muted-foreground py-6">
      <div>
        <label>
          {t("yeastBrand")}
          <Select
            defaultValue={selected.yeastBrand}
            onValueChange={setYeastBrand}
          >
            <SelectTrigger>
              <span>{selected.yeastBrand}</span>
            </SelectTrigger>
            <SelectContent>
              {Array.from(new Set(yeastList.map((yeast) => yeast.brand))).map(
                (brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </label>
      </div>
      <div>
        <label>
          <span className="flex items-center">
            {t("yeastStrain")}
            <Tooltip body={t("yeastSearch")} />
          </span>

          <SearchableInput
            items={yeastList.sort()}
            query={selected.yeastDetails.name}
            setQuery={(yeast) => setYeastName(yeast)}
            keyName="name"
            onSelect={(yeast) => {
              setYeastBrand(yeast.brand);
              setYeastName(yeast.name);
            }}
          />
        </label>
      </div>
      <div>
        <label className="grid gap-1">
          <span className="flex items-center sm:gap-1">
            {t("n2Requirement.label")}
            <Tooltip body={t("tipText.nitrogenRequirements")} />
          </span>
          <Select
            value={selected.yeastNitrogenRequirement}
            onValueChange={setNitrogenRequirement}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key="Low" value="Low">
                {t("n2Requirement.low")}
              </SelectItem>
              <SelectItem key="Medium" value="Medium">
                {t("n2Requirement.medium")}
              </SelectItem>
              <SelectItem key="High" value="High">
                {t("n2Requirement.high")}
              </SelectItem>
              <SelectItem key="Very High" value="Very High">
                {t("n2Requirement.veryHigh")}
              </SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
      <div>
        <span className="grid gap-1">
          <span className="flex items-center sm:gap-1">
            {t("targetYan")}
            <Tooltip body={t("tipText.yan")} />
          </span>
          <InputWithUnits value={targetYAN} text={"PPM"} disabled />
        </span>
      </div>
    </div>
  );
}

export default YeastDetails;
