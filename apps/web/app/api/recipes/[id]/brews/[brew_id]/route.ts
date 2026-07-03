import { getPublicBrewForRecipe } from "@/lib/db/brews";
import { NextRequest, NextResponse } from "next/server";

/**
 * Get public brew for recipe
 * @description Returns the read-only tracker data for a brew whose owner explicitly made it public and whose linked recipe is public.
 * @pathParams PublicRecipeBrewPathParams
 * @response 200:PublicRecipeBrewResponse
 * @responseSet none
 * @add 400:PublicBrewValidationErrorResponse
 * @add 404:PublicBrewNotFoundErrorResponse
 * @add 500:PublicBrewFetchErrorResponse
 * @tag Brews
 * @openapi
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; brew_id: string }> }
) {
  const { id, brew_id } = await params;
  const recipeId = Number(id);

  if (!Number.isInteger(recipeId)) {
    return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
  }

  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }

  try {
    const brew = await getPublicBrewForRecipe(recipeId, brew_id);

    if (!brew) {
      return NextResponse.json({ error: "Brew not found" }, { status: 404 });
    }

    return NextResponse.json({ brew });
  } catch (error) {
    console.error("Error fetching public recipe brew:", error);
    return NextResponse.json(
      { error: "Failed to fetch public brew" },
      { status: 500 }
    );
  }
}
