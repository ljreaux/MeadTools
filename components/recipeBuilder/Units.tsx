"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";
import { useTranslation } from "react-i18next";
import { Separator } from "../ui/separator";
import { useRecipe } from "@/components/providers/RecipeProvider";
import { VolumeUnit, WeightUnit } from "@/types/recipeData";

export default function Units() {
  const { t } = useTranslation();
  const {
    data: { unitDefaults },
    setUnitDefaults
  } = useRecipe();

  const changeWeight = (val: WeightUnit) =>
    setUnitDefaults({ ...unitDefaults, weight: val });

  const changeVolume = (val: VolumeUnit) =>
    setUnitDefaults({ ...unitDefaults, volume: val });

  return (
    <div className="joyride-units grid grid-cols-2 gap-2">
      <h3 className="text-base font-semibold col-span-full">{t("UNITS")}</h3>

      <label className="grid gap-1">
        {t("recipeBuilder.labels.weight")}
        <Select value={unitDefaults.weight} onValueChange={changeWeight}>
          <SelectTrigger className="h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lb">{t("LBS")}</SelectItem>
            <SelectItem value="kg">{t("KG")}</SelectItem>

            {/* you can expose these later if you actually want them globally */}
            {/* <SelectItem value="g">{t("G")}</SelectItem>
            <SelectItem value="oz">{t("OZ")}</SelectItem> */}
          </SelectContent>
        </Select>
      </label>

      <label className="grid gap-1">
        {t("nuteVolume")}
        <Select value={unitDefaults.volume} onValueChange={changeVolume}>
          <SelectTrigger className="h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gal">{t("GAL")}</SelectItem>
            <SelectItem value="L">{t("LIT")}</SelectItem>

            {/* later */}
            {/* <SelectItem value="mL">{t("ML")}</SelectItem>
            <SelectItem value="qt">{t("QT")}</SelectItem>
            <SelectItem value="pt">{t("PT")}</SelectItem>
            <SelectItem value="fl_oz">{t("FL_OZ")}</SelectItem> */}
          </SelectContent>
        </Select>
      </label>

      <Separator className="col-span-2 my-4" />
    </div>
  );
}
