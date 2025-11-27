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
  lastActivityEmailAt?: Date | null;
}
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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

type RecipesPageOpts = {
  page?: number;
  limit?: number;
  query?: string;
  onlyPublic?: boolean; // if true => private: false, otherwise all recipes
};

async function getRecipesPageBase(opts: RecipesPageOpts) {
  const page = Math.max(1, Number(opts.page) || 1);
  const take = Math.min(Math.max(Number(opts.limit) || 10, 1), 50); // 1–50
  const skip = (page - 1) * take;
  const query = (opts.query ?? "").trim();

  const where: Prisma.recipesWhereInput = {};

  if (opts.onlyPublic) {
    where.private = false;
  }

  if (query) {
    where.AND = [
      {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          {
            users: {
              public_username: { contains: query, mode: "insensitive" }
            }
          }
        ]
      }
    ];
  }

  const [recipes, totalCount] = await prisma.$transaction([
    prisma.recipes.findMany({
      where,
      skip,
      take,
      include: {
        users: { select: { public_username: true } }
      },
      orderBy: {
        id: "desc" // or created_at: "desc" if you have it
      }
    }),
    prisma.recipes.count({ where })
  ]);

  if (totalCount === 0) {
    return {
      recipes: [] as any[],
      totalCount: 0,
      totalPages: 0,
      page,
      limit: take
    };
  }

  const recipeIds = recipes.map((r) => r.id);

  const ratingRows = await prisma.recipe_ratings.groupBy({
    by: ["recipe_id"],
    where: { recipe_id: { in: recipeIds } },
    _avg: { rating: true },
    _count: { rating: true }
  });

  const ratingMap = new Map<number, { avg: number | null; count: number }>(
    ratingRows.map((r) => [
      r.recipe_id,
      { avg: r._avg.rating, count: r._count.rating }
    ])
  );

  const parsedRecipes = recipes.map((rec) => {
    const primaryNotes = concatNotes(rec.primaryNotes || []);
    const secondaryNotes = concatNotes(rec.secondaryNotes || []);
    const r = ratingMap.get(rec.id);
    const averageRating = r?.avg ?? 0;
    const numberOfRatings = r?.count ?? 0;

    return {
      ...rec,
      primaryNotes,
      secondaryNotes,
      public_username: rec.users?.public_username || "",
      averageRating,
      numberOfRatings
    };
  });

  const totalPages = Math.ceil(totalCount / take);

  return {
    recipes: parsedRecipes,
    totalCount,
    totalPages,
    page,
    limit: take
  };
}

// PUBLIC: just a thin wrapper that forces onlyPublic = true
export async function getPublicRecipesPage(opts: {
  page?: number;
  limit?: number;
  query?: string;
}) {
  return getRecipesPageBase({ ...opts, onlyPublic: true });
}

// ADMIN: all recipes (public + private)
export async function getAdminRecipesPage(opts: {
  page?: number;
  limit?: number;
  query?: string;
}) {
  return getRecipesPageBase({ ...opts, onlyPublic: false });
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
      private: data.private || false,
      lastActivityEmailAt: data.lastActivityEmailAt
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
