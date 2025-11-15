interface RecipeData {
  userId: number;
  name: string;
  recipeData: string;
  yanFromSource?: string | null;
  yanContribution: string;
  nutrientData: string;
  advanced: boolean;
  nuteInfo?: string | null;
  primaryNotes?: string[];
  secondaryNotes?: string[];
  private?: boolean;
}
import prisma from "@/lib/prisma";

function concatNotes(notes: string[]): string[][] {
  const newNotes = [];
  while (notes.length) newNotes.push(notes.splice(0, 2));

  return newNotes;
}

export async function getAllRecipesForUser(userId: number) {
  try {
    const recipes = await prisma.recipes.findMany({
      where: { user_id: userId },
      include: { users: { select: { public_username: true } } }
    });

    const parsedRecipes = recipes.map((rec) => {
      const primaryNotes = concatNotes(rec.primaryNotes);
      const secondaryNotes = concatNotes(rec.secondaryNotes);
      return {
        ...rec,
        primaryNotes,
        secondaryNotes,
        public_username: rec.users?.public_username || null
      };
    });

    return parsedRecipes;
  } catch (error) {
    console.error("Error fetching recipes for user:", error);
    throw new Error("Failed to fetch recipes.");
  }
}

export async function getAllRecipes() {
  try {
    const recipes = await prisma.recipes.findMany({
      include: {
        users: { select: { public_username: true } }
      }
    });

    if (recipes.length === 0) return [];

    // Collect recipe IDs and fetch ratings in one grouped query
    const recipeIds = recipes.map((r) => r.id);

    const ratingRows = await prisma.recipe_ratings.groupBy({
      by: ["recipe_id"],
      where: { recipe_id: { in: recipeIds } },
      _avg: { rating: true },
      _count: { rating: true }
    });

    // Map recipe_id -> { avg, count }
    const ratingMap = new Map<number, { avg: number | null; count: number }>(
      ratingRows.map((r) => [
        r.recipe_id,
        { avg: r._avg.rating, count: r._count.rating }
      ])
    );

    // Shape the final payload
    const parsedRecipes = recipes.map((rec) => {
      const primaryNotes = concatNotes(rec.primaryNotes || []);
      const secondaryNotes = concatNotes(rec.secondaryNotes || []);
      const r = ratingMap.get(rec.id);
      const averageRating = r?.avg ?? 0; // number | 0 if none
      const numberOfRatings = r?.count ?? 0; // 0 if none

      return {
        ...rec,
        primaryNotes,
        secondaryNotes,
        public_username: rec.users?.public_username || "",
        averageRating,
        numberOfRatings
      };
    });

    return parsedRecipes;
  } catch (error) {
    console.error("Error fetching recipes:", error);
    throw new Error("Database error");
  }
}

export async function createRecipe(data: RecipeData) {
  return prisma.recipes.create({
    data: {
      user_id: data.userId,
      name: data.name,
      recipeData: data.recipeData,
      yanFromSource: data.yanFromSource,
      yanContribution: data.yanContribution,
      nutrientData: data.nutrientData,
      advanced: data.advanced,
      nuteInfo: data.nuteInfo,
      primaryNotes: data.primaryNotes || [],
      secondaryNotes: data.secondaryNotes || [],
      private: data.private || false
    }
  });
}

export async function getRecipeInfo(recipeId: number) {
  try {
    const recipe = await prisma.recipes.findUnique({
      where: { id: recipeId },
      include: {
        users: { select: { public_username: true } },
        comments: {
          where: { parent_id: null, deleted_at: null },
          orderBy: { created_at: "asc" },
          include: {
            author: { select: { id: true, public_username: true } },
            replies: {
              where: { deleted_at: null },
              orderBy: { created_at: "asc" },
              include: {
                author: { select: { id: true, public_username: true } }
              }
            }
          }
        },
        ratings: {
          select: { rating: true, user_id: true }
        }
      }
    });

    if (!recipe) return null;

    const avgRating =
      recipe.ratings.length > 0
        ? recipe.ratings.reduce((a, r) => a + r.rating, 0) /
          recipe.ratings.length
        : null;

    return {
      ...recipe,
      primaryNotes: concatNotes(recipe.primaryNotes),
      secondaryNotes: concatNotes(recipe.secondaryNotes),
      public_username: recipe.users?.public_username || null,
      averageRating: avgRating,
      commentCount: recipe.comments.length
    };
  } catch (error) {
    console.error("Error fetching recipe info:", error);
    throw new Error("Database error");
  }
}

export const verifyRecipeId = async (params: Promise<{ id: string }>) => {
  const { id } = await params;
  const recipeId = parseInt(id);
  return recipeId;
};

export async function updateRecipe(id: string, fields: Partial<RecipeData>) {
  return prisma.recipes.update({
    where: { id: parseInt(id, 10) }, // Ensure id is converted to an integer
    data: fields
  });
}

export async function deleteRecipe(id: string) {
  return prisma.recipes.delete({
    where: { id: Number(id) }
  });
}
