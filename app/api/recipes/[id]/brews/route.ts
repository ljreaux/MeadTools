import { getPublicBrewsForRecipe } from "@/lib/db/brews";
import { NextRequest, NextResponse } from "next/server";

/**
 * List public brews for recipe
 * @description Returns brews whose owners explicitly made them public for the given public recipe. Private recipes and private brews return an empty list.
 * @pathParams PublicRecipeBrewsPathParams
 * @response 200:PublicRecipeBrewsResponse
 * @responseSet none
 * @add 400:PublicBrewValidationErrorResponse
 * @add 500:PublicBrewFetchErrorResponse
 * @tag Brews
 * @openapi
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const recipeId = Number(id);

  if (!Number.isInteger(recipeId)) {
    return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
  }

  try {
    const brews = await getPublicBrewsForRecipe(recipeId);
    return NextResponse.json({ brews });
  } catch (error) {
    console.error("Error fetching public recipe brews:", error);
    return NextResponse.json(
      { error: "Failed to fetch public brews" },
      { status: 500 }
    );
  }
}
