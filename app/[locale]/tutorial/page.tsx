"use client";

import SavedRecipeProvider from "@/components/providers/SavedRecipeProvider";
import RecipeBuilderTutorial from "@/components/recipeBuilder/RecipeBuilderTutorial";
import { parseRecipeData } from "@/lib/utils/parseRecipeData";
import { useEffect } from "react";
import tutorialRecipeData from "@/data/tutorialRecipe.json";

function RecipeTutorial() {
  useEffect(() => {
    localStorage.setItem("hasSeenTutorialDialog", "true");
  }, []);

  const recipe = tutorialRecipeData.recipe as any;

  const { recipeData, nutrientData, getSelectedSchedule, yanContribution } =
    parseRecipeData(recipe);

  const hydratedRecipe = {
    ...recipe,
    recipeData,
    nutrientData: {
      ...nutrientData,
      selected: {
        ...nutrientData.selected,
        selectedNutrients: getSelectedSchedule(nutrientData.selected.schedule)
      }
    },
    yanContribution
  };

  return (
    <SavedRecipeProvider recipe={hydratedRecipe}>
      <RecipeBuilderTutorial />
    </SavedRecipeProvider>
  );
}

export default RecipeTutorial;
