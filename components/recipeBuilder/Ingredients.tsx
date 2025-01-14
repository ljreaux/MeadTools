import { Ingredient, IngredientDetails } from "@/types/recipeDataTypes";
import { useRecipe } from "../providers/RecipeProvider";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import Loading from "../loading";
import SearchableInput from "../ui/SearchableInput";
import { useTranslation } from "react-i18next";
import InputWithUnits from "../nutrientCalc/InputWithUnits";

function Ingredients() {
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
  } = useRecipe();

  if (loadingIngredients) {
    return <Loading />;
  }

  return (
    <div className="grid gap-4 items-center border-b border-muted-foreground py-6">
      <h3>Ingredients</h3>
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
        Add New Ingredient
      </Button>
    </div>
  );
}

export default Ingredients;

const IngredientLine = ({
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
}) => {
  const { ingredientList } = useRecipe();
  const { t } = useTranslation();
  const { units } = useRecipe();

  const handleIngredientSelect = (selectedIngredient: Ingredient) => {
    // Translate the name when the ingredient is selected
    changeIng(selectedIngredient.name); // Pass the translated name
  };

  return (
    <div className="grid grid-cols-2 gap-2 py-6">
      <label>
        Name
        <SearchableInput
          items={ingredientList}
          query={ing.name}
          setQuery={(value) => changeIng(value)}
          keyName="name"
          onSelect={handleIngredientSelect} // Set the full ingredient details when selected
        />
      </label>

      {/* Other fields */}
      <label>
        Brix
        <Input
          value={ing.brix}
          inputMode="numeric"
          onFocus={(e) => e.target.select()}
          onChange={(e) => updateBrix(e.target.value)}
        />
      </label>

      <label>
        Weight
        <InputWithUnits
          value={ing.details[0]}
          handleChange={(e) => updateWeight(e.target.value)}
          text={units.weight}
        />
      </label>

      <label>
        Volume
        <InputWithUnits
          value={ing.details[1]}
          handleChange={(e) => updateVolume(e.target.value)}
          text={units.volume}
        />
      </label>

      <label className="flex gap-1 flex-col sm:flex-row items-center justify-center">
        Secondary Addition?
        <Switch checked={ing.secondary} onCheckedChange={toggleChecked} />
      </label>

      <Button onClick={deleteFn} variant="destructive">
        Remove
      </Button>
    </div>
  );
};
