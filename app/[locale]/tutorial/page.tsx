"use client";

import { useEffect } from "react";

import RecipeBuilderTutorial from "@/components/recipeBuilder/RecipeBuilderTutorial";

// ✅ this should be the already-migrated tutorial blob you create
import tutorialRecipeV2 from "@/data/tutorialRecipe.v2.json";
import { RecipeProvider } from "@/components/providers/RecipeProvider";
import { RecipeWithParsedFields } from "@/hooks/reactQuery/useRecipeQuery";

function RecipeTutorial() {
  useEffect(() => {
    localStorage.setItem("hasSeenTutorialDialog", "true");
  }, []);

  const recipe = tutorialRecipeV2.recipe as RecipeWithParsedFields;

  return (
    <RecipeProvider>
      <RecipeBuilderTutorial recipe={recipe} />
    </RecipeProvider>
  );
}

export default RecipeTutorial;
