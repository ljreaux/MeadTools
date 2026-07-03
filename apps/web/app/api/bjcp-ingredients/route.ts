import { createIngredients, getIngredients } from "@/lib/db/bjcp-ingredients";
import { verifyAdmin } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";

/**
 * List BJCP ingredients
 * @description Returns the BJCP ingredient catalog used by recipe-building tools.
 * @response 200:BjcpIngredientsResponse
 * @responseSet none
 * @add 500:BjcpIngredientsFetchErrorResponse
 * @tag BJCP Ingredients
 * @openapi
 */
export async function GET() {
  try {
    const ingredients = await getIngredients();

    return new NextResponse(JSON.stringify(ingredients), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Change "*" to your domain if needed
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Error fetching ingredients:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to fetch ingredients" }),
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
}

/**
 * Create BJCP ingredient
 * @description Admin-only. Creates a BJCP ingredient catalog entry.
 * @body CreateBjcpIngredientRequestBody
 * @response 201:BjcpIngredientResponse
 * @responseSet none
 * @add 401:AdminAuthErrorResponse
 * @add 403:AdminAuthErrorResponse
 * @add 404:AdminAuthErrorResponse
 * @add 500:CreateBjcpIngredientFailureErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
export async function POST(req: NextRequest) {
  // Check for admin privileges
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) {
    return adminOrResponse;
  }

  try {
    const body = await req.json();
    const newIngredient = await createIngredients(body);

    return NextResponse.json(newIngredient, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create ingredient" },
      { status: 500 }
    );
  }
}
