import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";
import { useTranslation } from "react-i18next";
import { Recipe } from "@/types/recipeDataTypes";
import { Separator } from "../ui/separator";

function Units({ useRecipe }: { useRecipe: () => Recipe }) {
  const { units, changeVolumeUnits, changeWeightUnits } = useRecipe();
  const { t } = useTranslation();
  return (
    <div className="joyride-units grid grid-cols-2 gap-2">
      <h3 className="text-base font-semibold col-span-full">{t("UNITS")}</h3>

      <label className="grid gap-1">
        {t("recipeBuilder.labels.weight")}
        <Select value={units.weight} onValueChange={changeWeightUnits}>
          <SelectTrigger className="h-12">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="lbs">{t("LBS")}</SelectItem>
            <SelectItem value="kg">{t("KG")}</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="grid gap-1">
        {t("nuteVolume")}
        <Select value={units.volume} onValueChange={changeVolumeUnits}>
          <SelectTrigger className="h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gal">{t("GAL")}</SelectItem>
            <SelectItem value="liter">{t("LIT")}</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <Separator className="col-span-2 my-4" />
    </div>
  );
}

export default Units;
