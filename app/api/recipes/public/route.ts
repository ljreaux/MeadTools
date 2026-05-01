import { NextRequest, NextResponse } from "next/server";
import { getPublicRecipesPage } from "@/lib/db/recipes";
import type { RecipeDataV2Response } from "../../openapi-types";

export type PublicRecipesQueryParams = {
  page?: string;
  limit?: string;
  q?: string;
  query?: string;
};

export type PublicRecipeOwnerResponse = {
  public_username: string | null;
  active: boolean;
};

export type PublicRecipeListItemResponse = {
  id: number;
  user_id: number | null;
  name: string;
  recipeData: string;
  yanFromSource: string | null;
  yanContribution: string;
  nutrientData: string;
  advanced: boolean;
  nuteInfo: string | null;
  primaryNotes: string[][];
  secondaryNotes: string[][];
  dataV2: RecipeDataV2Response | null;
  version: number;
  private: boolean;
  lastActivityEmailAt: string | null;
  activityEmailsEnabled: boolean;
  users: PublicRecipeOwnerResponse | null;
  public_username: string;
  averageRating: number;
  numberOfRatings: number;
};

export type PublicRecipesPageResponse = {
  recipes: PublicRecipeListItemResponse[];
  totalCount: number;
  totalPages: number;
  page: number;
  limit: number;
};

export type PublicRecipesFetchErrorResponse = {
  error: "Failed to fetch recipes";
};

/**
 * List public recipes
 * @description Returns a paginated list of public recipes, optionally filtered by recipe name or owner username.
 * @params PublicRecipesQueryParams
 * @response 200:PublicRecipesPageResponse
 * @responseSet none
 * @add 500:PublicRecipesFetchErrorResponse
 * @tag Recipes
 * @openapi
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    // support both ?q= and ?query= just in case
    const queryParam = searchParams.get("q") ?? searchParams.get("query") ?? "";

    const page = pageParam ? Number(pageParam) : undefined;
    const limit = limitParam ? Number(limitParam) : undefined;

    const result = await getPublicRecipesPage({
      page,
      limit,
      query: queryParam || undefined
    });

    // result already looks like:
    // {
    //   recipes,
    //   totalCount,
    //   totalPages,
    //   page,
    //   limit
    // }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching public recipes (paginated):", error);
    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 500 }
    );
  }
}
