"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltips";
import SearchableInput from "../ui/SearchableInput";
import { useNutrients } from "@/components/providers/NutrientProvider";

export default function YeastDetails() {
  const { t } = useTranslation();
  const { data, actions, catalog } = useNutrients();
  const { yeastList, brands } = catalog;
  const selected = data.selected;

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

          <Select
            value={selected.yeastBrand}
            onValueChange={actions.setYeastBrand}
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder={selected.yeastBrand} />
            </SelectTrigger>
            <SelectContent>
              {brands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
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
            items={yeastList}
            query={selected.yeastStrain}
            setQuery={actions.setYeastStrain}
            keyName="name"
            onSelect={actions.selectYeast}
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
            value={selected.nitrogenRequirement}
            onValueChange={(req) =>
              actions.setNitrogenRequirement(
                req as typeof selected.nitrogenRequirement
              )
            }
          >
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">{t("n2Requirement.low")}</SelectItem>
              <SelectItem value="Medium">
                {t("n2Requirement.medium")}
              </SelectItem>
              <SelectItem value="High">{t("n2Requirement.high")}</SelectItem>
              <SelectItem value="Very High">
                {t("n2Requirement.veryHigh")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
