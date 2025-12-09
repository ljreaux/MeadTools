import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, verifyUser } from "@/lib/userAccessFunctions";
import { deleteRecipe, getRecipeInfo, updateRecipe } from "@/lib/db/recipes";

// GET /api/recipes/:id
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
      return NextResponse.json({ recipe });
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const recipeId = parseInt(id);

  if (isNaN(recipeId)) {
    return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
  }

  // Verify user authentication
  const userOrResponse = await verifyUser(request);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse;
  }

  const userId = userOrResponse;

  const isAdmin = await requireAdmin(userId);
  const recipe = await getRecipeInfo(recipeId);

  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (userId && (recipe.user_id === userId || isAdmin)) {
      const updatedRecipe = await updateRecipe(recipeId.toString(), body);

      return NextResponse.json(updatedRecipe);
    } else {
      return NextResponse.json(
        { error: "You are not authorized to update this recipe" },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error("Error updating recipe:", error);
    return NextResponse.json(
      { error: "Failed to update recipe" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const recipeId = parseInt(id);
  if (isNaN(recipeId)) {
    return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
  }
  // Verify user authentication
  const userOrResponse = await verifyUser(request);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }
  const userId = userOrResponse;

  const isAdmin = await requireAdmin(userId);
  const recipe = await getRecipeInfo(recipeId);

  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  try {
    if (userId && (recipe.user_id === userId || isAdmin)) {
      const deletedRecipe = await deleteRecipe(id);
      return NextResponse.json({
        message: `${deletedRecipe.name} has been deleted.`
      });
    } else {
      return NextResponse.json(
        { error: "You are not authorized to delete this recipe" },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error("Error deleting recipe:", error);
    return NextResponse.json(
      { error: "Failed to delete recipe" },
      { status: 500 }
    );
  }
}
