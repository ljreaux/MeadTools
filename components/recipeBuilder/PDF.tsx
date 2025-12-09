import PrintableIframe from "./PrintableIframe";
import RecipeView from "./RecipeView";
import { Recipe } from "@/types/recipeDataTypes";
import { NutrientType } from "@/types/nutrientTypes";

function PDF({
  useRecipe,
  useNutrients
}: {
  useNutrients: () => NutrientType;
  useRecipe: () => Recipe;
}) {
  const nutrientData = useNutrients();
  const recipeData = useRecipe();
  return (
    <PrintableIframe
      content={
        <RecipeView nutrientData={nutrientData} recipeData={recipeData} />
      }
    />
  );
}

export default PDF;
