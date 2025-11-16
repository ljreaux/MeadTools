import { RecipeApiResponse } from "@/hooks/useRecipeQuery";

export const parseRecipeData = (recipe: RecipeApiResponse) => {
  const recipeData = JSON.parse(recipe.recipeData);
  const nutrientData = JSON.parse(recipe.nutrientData);
  const yanContribution = JSON.parse(recipe.yanContribution);

  const yanFromSource = JSON.parse(recipe.yanFromSource);
  const nuteInfo = JSON.parse(recipe.nuteInfo);
  const privateRecipe = JSON.parse(JSON.stringify(recipe.private));
  const emailNotifications = !!JSON.parse(
    JSON.stringify(recipe.lastActivityEmailAt)
  );

  const getSelectedSchedule = (schedule: string) => {
    switch (schedule) {
      case "tbe":
        return ["Fermaid O", "Fermaid K", "DAP"]; // Fermaid O, K, and DAP
      case "oAndk":
        return ["Fermaid O", "Fermaid K"]; // Fermaid O & K
      case "oAndDap":
        return ["Fermaid O", "DAP"]; // Fermaid O & DAP
      case "kAndDap":
        return ["Fermaid K", "DAP"]; // Fermaid K & DAP
      case "tosna":
        return ["Fermaid O"]; // Fermaid O Only
      case "justK":
        return ["Fermaid K"]; // Fermaid K Only
      case "dap":
        return ["DAP"]; // DAP Only
      case "other":
      default:
        return ["Other"]; // Default case is "Other"
    }
  };

  return {
    recipeData,
    nutrientData,
    yanContribution,
    yanFromSource,
    nuteInfo,
    getSelectedSchedule,
    privateRecipe,
    averageRating: recipe.averageRating ?? 0,
    numberOfRatings: recipe.ratings.length,
    emailNotifications
  };
};
