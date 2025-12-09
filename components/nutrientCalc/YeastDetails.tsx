import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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
    setNitrogenRequirement
  } = useNutrients();

  return (
    <div className="joyride-yeastDetails flex flex-col gap-4">
      <h3 className="text-base font-semibold">{t("yeastDetails")}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Yeast brand */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">
            <span className="flex items-center sm:gap-1 mb-1">
              {t("yeastBrand")}
            </span>
          </label>
          <Select value={selected.yeastBrand} onValueChange={setYeastBrand}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder={selected.yeastBrand} />
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
        </div>

        {/* Yeast strain (searchable) */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">
            <span className="flex items-center sm:gap-1">
              {t("yeastStrain")}
              <Tooltip body={t("yeastSearch")} />
            </span>
          </label>

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
        </div>

        {/* Nitrogen requirement */}
        <div className="grid gap-1 col-span-full">
          <label className="text-sm font-medium">
            <span className="flex items-center sm:gap-1">
              {t("n2Requirement.label")}
              <Tooltip body={t("tipText.nitrogenRequirements")} />
            </span>
          </label>

          <Select
            value={selected.yeastNitrogenRequirement}
            onValueChange={setNitrogenRequirement}
          >
            <SelectTrigger className="h-12">
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
        </div>
      </div>
    </div>
  );
}

export default YeastDetails;
