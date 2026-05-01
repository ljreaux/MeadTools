import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, verifyUser } from "@/lib/userAccessFunctions";
import { getRecipeInfo } from "@/lib/db/recipes";
import calculateRecipeDerivedApiResponse from "@/lib/utils/calculateRecipeDerivedApiResponse";
import { isRecipeData } from "@/types/recipeData";

/**
 * Get recipe derived state by ID
 * @description Returns v2 recipe data plus the same derived recipe state used by the recipe builder. Public recipes are accessible to everyone; private recipes require the owner or an admin bearer token.
 * @pathParams RecipePathParams
 * @response 200:RecipeDerivedStateResponseBody
 * @responseSet none
 * @add 400:RecipeDerivedByIdValidationErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 403:RecipeForbiddenErrorResponse
 * @add 404:RecipeNotFoundErrorResponse
 * @add 500:RecipeDerivedFailureErrorResponse
 * @tag Recipes
 * @openapi
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const recipeId = parseInt(id);

  if (isNaN(recipeId)) {
    return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
  }

  try {
    const authHeader = request.headers.get("Authorization");
    let userId = null;
    let isAdmin = false;

    // Attempt to verify user
    if (authHeader) {
      try {
        userId = await verifyUser(request);
        if (userId instanceof NextResponse) return userId;
        isAdmin = await requireAdmin(userId);
      } catch (err) {
        console.error("Error verifying user:", err);
      }
    }

    const recipe = await getRecipeInfo(recipeId);

    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    // Check visibility: public recipes are accessible to everyone
    // Private recipes are accessible only to the creator or an admin
    if (!recipe.private || (userId && (recipe.user_id === userId || isAdmin))) {
      if (!isRecipeData(recipe.dataV2)) {
        return NextResponse.json(
          { error: "Recipe does not have valid dataV2." },
          { status: 400 }
        );
      }

      return NextResponse.json(calculateRecipeDerivedApiResponse(recipe.dataV2));
    } else {
      return NextResponse.json(
        { error: "You are not authorized to view this recipe" },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error("Error fetching recipe:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching the recipe" },
      { status: 500 }
    );
  }
}
