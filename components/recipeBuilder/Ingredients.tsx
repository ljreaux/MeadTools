import { Ingredient, IngredientDetails, Recipe } from "@/types/recipeDataTypes";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import Loading from "../loading";
import SearchableInput from "../ui/SearchableInput";
import { useTranslation } from "react-i18next";
import InputWithUnits from "../nutrientCalc/InputWithUnits";
import DragList from "../ui/DragList";
import Tooltip from "../Tooltips";
import lodash from "lodash";
import { Separator } from "../ui/separator";
import { Trash } from "lucide-react";

function Ingredients({ useRecipe }: { useRecipe: () => Recipe }) {
  const { t } = useTranslation();
  const {
    ingredients,
    removeIngredient,
    changeIngredient,
    loadingIngredients,
    updateIngredientWeight,
    updateIngredientVolume,
    updateBrix,
    toggleSecondaryChecked,
    addIngredient,
    ingredientList,
    units,
    fillToNearest,
    setIngredients
  } = useRecipe();

  if (loadingIngredients) {
    return <Loading />;
  }

  return (
    <div className="py-6">
      <div className="grid gap-4">
        <h3 className="text-base font-semibold">
          {t("recipeBuilder.labels.ingredients")}
        </h3>

        <div>
          {ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "recipeBuilder.emptyIngredients",
                "Add some ingredients to continue building your recipe."
              )}
            </p>
          ) : (
            <DragList
              items={ingredients}
              setItems={setIngredients}
              renderItem={(ing, i) => (
                <IngredientLine
                  units={units}
                  ingredientList={ingredientList}
                  ing={ing}
                  deleteFn={() => removeIngredient(ing.id)}
                  changeIng={(val) => changeIngredient(ing, i, val)}
                  updateWeight={(val) => {
                    updateIngredientWeight(ing, ing.id, val);
                  }}
                  updateVolume={(val) => {
                    updateIngredientVolume(ing, ing.id, val);
                  }}
                  updateBrix={(val) => {
                    updateBrix(val, ing.id);
                  }}
                  toggleChecked={(val) => {
                    toggleSecondaryChecked(ing.id, val);
                  }}
                  fillToNearest={() => fillToNearest(ing.id)}
                  index={i}
                />
              )}
            />
          )}
        </div>

        <Button
          onClick={addIngredient}
          variant="secondary"
          disabled={ingredients.length >= 10}
          className="w-full sm:w-auto"
        >
          {t("recipeBuilder.addNew")}
        </Button>
      </div>

      <Separator className="mt-4" />
    </div>
  );
}

export default Ingredients;

const IngredientLine = ({
  units,
  ingredientList,
  ing,
  deleteFn,
  changeIng,
  updateWeight,
  updateVolume,
  updateBrix,
  toggleChecked,
  fillToNearest,
  index
}: {
  ing: IngredientDetails;
  deleteFn: () => void;
  changeIng: (val: string) => void;
  updateWeight: (val: string) => void;
  updateVolume: (val: string) => void;
  updateBrix: (val: string) => void;
  toggleChecked: (val: boolean) => void;
  ingredientList: Ingredient[];
  units: { weight: string; volume: string };
  fillToNearest: () => void;
  index: number;
}) => {
  const { t } = useTranslation();

  const handleIngredientSelect = (selectedIngredient: Ingredient) => {
    changeIng(selectedIngredient.name);
  };

  return (
    <div className={`joyride-ingredient-${index + 1} grid gap-1`}>
      {/* Top-right delete button */}
      <div className="flex justify-end mt-2">
        <Button onClick={deleteFn} variant="destructive" size="sm">
          <Trash className="h-4 w-4" />
        </Button>
      </div>

      {/* Row 1: Ingredient + Brix (equal widths) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ingredient */}
        <label className="grid gap-1">
          <span className="flex items-center gap-1 text-sm font-medium">
            {t("ingredient")} <Tooltip body={t("ingredientTooltip")} />
          </span>
          <div className="w-full">
            <SearchableInput
              items={ingredientList}
              query={ing.name}
              setQuery={(value) => changeIng(value)}
              keyName="name"
              onSelect={handleIngredientSelect}
              renderItem={(item) => t(lodash.camelCase(item.name))}
            />
          </div>
        </label>

        {/* Brix */}
        <label className="grid gap-1">
          <span className="text-sm font-medium">{t("BRIX")}</span>
          <div className="w-full">
            <InputWithUnits
              value={ing.brix}
              handleChange={(e) => updateBrix(e.target.value)}
              text={t("BRIX")}
            />
          </div>
        </label>
      </div>

      {/* Row 2: Weight + Volume (already equal widths) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="grid gap-1">
          <span className="text-sm font-medium">
            {t("recipeBuilder.labels.weight")}
          </span>
          <div className="w-full">
            <InputWithUnits
              value={ing.details[0]}
              handleChange={(e) => updateWeight(e.target.value)}
              text={units.weight}
            />
          </div>
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">
            {t("recipeBuilder.labels.volume")}
          </span>
          <div className="w-full">
            <InputWithUnits
              value={ing.details[1]}
              handleChange={(e) => updateVolume(e.target.value)}
              text={units.volume}
            />
          </div>
        </label>
      </div>

      {/* Row 3: Secondary + fill to next (no delete here) */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between my-2">
        <label
          className={`joyride-secondary-${index + 1} inline-flex items-center gap-2 text-sm`}
        >
          <span>{t("recipeBuilder.labels.secondary")}</span>
          <Switch checked={ing.secondary} onCheckedChange={toggleChecked} />
        </label>

        <Button
          onClick={fillToNearest}
          className={`joyride-fillToNext-${index + 1}`}
        >
          {t("toNextVolume", { volumeUnit: units.volume })}
        </Button>
      </div>
    </div>
  );
};
