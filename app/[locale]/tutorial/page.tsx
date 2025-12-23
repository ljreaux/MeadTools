"use client";

import { useEffect } from "react";

import RecipeBuilderTutorial from "@/components/recipeBuilder/RecipeBuilderTutorial";

// ✅ this should be the already-migrated tutorial blob you create
import tutorialRecipeV2 from "@/data/tutorialRecipe.v2.json";
import { RecipeV2Provider } from "@/components/providers/RecipeProviderV2";
import { RecipeWithParsedFields } from "@/hooks/reactQuery/useRecipeQuery";

function RecipeTutorial() {
  useEffect(() => {
    localStorage.setItem("hasSeenTutorialDialog", "true");
  }, []);

  const recipe = tutorialRecipeV2.recipe as RecipeWithParsedFields;

  return (
    <RecipeV2Provider>
      <RecipeBuilderTutorial recipe={recipe} />
    </RecipeV2Provider>
  );
}

export default RecipeTutorial;
