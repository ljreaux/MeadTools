import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";
import { useTranslation } from "react-i18next";
import { Recipe } from "@/types/recipeDataTypes";

function Units({ useRecipe }: { useRecipe: () => Recipe }) {
  const { units, changeVolumeUnits, changeWeightUnits } = useRecipe();
  const { t } = useTranslation();
  return (
    <div className="joyride-units grid grid-cols-2 gap-2 border-b border-muted-foreground py-6">
      <h2 className="col-span-2">{t("UNITS")}</h2>

      <label>
        {t("recipeBuilder.labels.weight")}
        <Select value={units.weight} onValueChange={changeWeightUnits}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="lbs">{t("LBS")}</SelectItem>
            <SelectItem value="kg">{t("KG")}</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label>
        {t("nuteVolume")}
        <Select value={units.volume} onValueChange={changeVolumeUnits}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gal">{t("GAL")}</SelectItem>
            <SelectItem value="liter">{t("LIT")}</SelectItem>
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}

export default Units;
