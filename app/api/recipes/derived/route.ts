import { NextRequest, NextResponse } from "next/server";
import calculateRecipeDerivedApiResponse from "@/lib/utils/calculateRecipeDerivedApiResponse";
import { isRecipeData } from "@/types/recipeData";

/**
 * Calculate recipe derived state
 * @description Calculates the same derived recipe state used by the recipe builder from a v2 recipe data payload.
 * @body RecipeDataV2Response
 * @response 200:RecipeDerivedStateResponseBody
 * @responseSet none
 * @add 400:RecipeDerivedValidationErrorResponse
 * @add 500:RecipeDerivedFailureErrorResponse
 * @tag Recipes
 * @openapi
 */
export async function POST(request: NextRequest) {
  try {
    let recipeData: unknown;

    try {
      recipeData = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid recipe data payload." },
        { status: 400 }
      );
    }

    if (!isRecipeData(recipeData)) {
      return NextResponse.json(
        { error: "Invalid recipe data payload." },
        { status: 400 }
      );
    }

    return NextResponse.json(calculateRecipeDerivedApiResponse(recipeData));
  } catch (error) {
    console.error("Error calculating recipe derived state:", error);
    return NextResponse.json(
      { error: "Failed to calculate recipe derived state" },
      { status: 500 }
    );
  }
}
