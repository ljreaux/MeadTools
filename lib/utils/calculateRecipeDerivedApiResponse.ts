import {
  calculateRecipeDerivedApiResponse,
  type RecipeDerivedApiResponse as CoreRecipeDerivedApiResponse
} from "@meadtools/core/derived";
import type { RecipeData } from "@/types/recipeData";

export type RecipeDerivedApiResponse =
  CoreRecipeDerivedApiResponse<RecipeData>;

export default calculateRecipeDerivedApiResponse;
