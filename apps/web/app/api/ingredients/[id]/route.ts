import { verifyAdmin } from "@/lib/userAccessFunctions";
import {
  deleteIngredient,
  getIngredientById,
  updateIngredient
} from "@/lib/db/ingredients";
import { NextRequest, NextResponse } from "next/server";

/**
 * Get ingredient by ID
 * @description Returns a single ingredient by numeric ID, or null when no ingredient matches.
 * @pathParams IngredientByIdPathParams
 * @response 200:IngredientByIdResponse
 * @responseSet none
 * @add 500:IngredientByIdErrorResponse
 * @tag Ingredients
 * @openapi
 */
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const yeast = await getIngredientById(Number(id));
    return NextResponse.json(yeast);
  } catch (error: any) {
    console.error("Error fetching ingredient by ID:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch ingredient by ID" },
      { status: 500 }
    );
  }
}

/**
 * Update ingredient
 * @description Admin-only. Updates an ingredient by numeric ID.
 * @pathParams IngredientByIdPathParams
 * @body UpdateIngredientRequestBody
 * @response 200:IngredientResponse
 * @responseSet none
 * @add 401:AdminAuthErrorResponse
 * @add 403:AdminAuthErrorResponse
 * @add 404:AdminAuthErrorResponse
 * @add 500:UpdateIngredientFailureErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check for admin privileges
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) {
    return adminOrResponse;
  }

  try {
    const body = await req.json();
    const { id } = await params;
    const updatedIngredient = await updateIngredient(id, body);

    return NextResponse.json(updatedIngredient);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update ingredient" },
      { status: 500 }
    );
  }
}

/**
 * Delete ingredient
 * @description Admin-only. Deletes an ingredient by numeric ID.
 * @pathParams IngredientByIdPathParams
 * @response 200:DeleteIngredientSuccessResponse
 * @responseSet none
 * @add 401:AdminAuthErrorResponse
 * @add 403:AdminAuthErrorResponse
 * @add 404:AdminAuthErrorResponse
 * @add 500:DeleteIngredientFailureErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check for admin privileges
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) {
    return adminOrResponse;
  }

  try {
    const { id } = await params;
    const deletedIngredient = await deleteIngredient(id);

    return NextResponse.json({
      message: `${deletedIngredient.name} has been deleted`
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete ingredient" },
      { status: 500 }
    );
  }
}
