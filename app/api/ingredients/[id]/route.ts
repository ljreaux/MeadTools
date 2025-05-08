import { verifyAdmin } from "@/lib/userAccessFunctions";
import {
  deleteIngredient,
  getIngredientById,
  updateIngredient,
} from "@/lib/db/ingredients";
import { NextRequest, NextResponse } from "next/server";

// GET /api/yeasts/:id
export async function GET(
  req: NextRequest,
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

// PATCH /api/ingredients/:ingredientId
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

// DELETE /api/ingredients/:ingredientId
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
      message: `${deletedIngredient.name} has been deleted`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete ingredient" },
      { status: 500 }
    );
  }
}
