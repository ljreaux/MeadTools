import { Ingredient, IngredientDetails, Recipe } from "@/types/recipeDataTypes";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import Loading from "../loading";
import SearchableInput from "../ui/SearchableInput";
import { useTranslation } from "react-i18next";
import InputWithUnits from "../nutrientCalc/InputWithUnits";

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
  } = useRecipe();

  if (loadingIngredients) {
    return <Loading />;
  }

  return (
    <div className="grid gap-4 items-center border-b border-muted-foreground py-6">
      <h3> {t("recipeBuilder.labels.ingredients")}</h3>
      <span>
        {ingredients.length === 0
          ? "Add Some Ingredients to Continue Building your Recipe."
          : ingredients.map((ing, i) => {
              return (
                <div
                  className={`${
                    i !== ingredients.length - 1
                      ? "border-b border-dotted "
                      : ""
                  }`}
                  key={i}
                >
                  <IngredientLine
                    units={units}
                    ingredientList={ingredientList}
                    ing={ing}
                    deleteFn={() => removeIngredient(i)}
                    changeIng={(val) => changeIngredient(i, val)}
                    updateWeight={(val) => {
                      updateIngredientWeight(ing, i, val);
                    }}
                    updateVolume={(val) => {
                      updateIngredientVolume(ing, i, val);
                    }}
                    updateBrix={(val) => {
                      updateBrix(val, i);
                    }}
                    toggleChecked={(val) => {
                      toggleSecondaryChecked(i, val);
                    }}
                  />
                </div>
              );
            })}
      </span>
      <Button
        onClick={addIngredient}
        variant={"secondary"}
        disabled={ingredients.length >= 10}
      >
        {t("recipeBuilder.addNew")}
      </Button>
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
}) => {
  const { t } = useTranslation();

  const handleIngredientSelect = (selectedIngredient: Ingredient) => {
    changeIng(selectedIngredient.name);
  };

  return (
    <div className="grid grid-cols-2 gap-2 py-6">
      <label>
        {t("ingredient")}
        <SearchableInput
          items={ingredientList}
          query={ing.name}
          setQuery={(value) => changeIng(value)}
          keyName="name"
          onSelect={handleIngredientSelect}
        />
      </label>

      {/* Other fields */}
      <label>
        {t("BRIX")}
        <Input
          value={ing.brix}
          inputMode="numeric"
          onFocus={(e) => e.target.select()}
          onChange={(e) => updateBrix(e.target.value)}
        />
      </label>

      <label>
        {t("recipeBuilder.labels.weight")}
        <InputWithUnits
          value={ing.details[0]}
          handleChange={(e) => updateWeight(e.target.value)}
          text={units.weight}
        />
      </label>

      <label>
        {t("recipeBuilder.labels.volume")}
        <InputWithUnits
          value={ing.details[1]}
          handleChange={(e) => updateVolume(e.target.value)}
          text={units.volume}
        />
      </label>

      <label className="flex gap-1 flex-col sm:flex-row items-center justify-center">
        {t("recipeBuilder.labels.secondary")}
        <Switch checked={ing.secondary} onCheckedChange={toggleChecked} />
      </label>

      <Button onClick={deleteFn} variant="destructive">
        Remove
      </Button>
    </div>
  );
};
