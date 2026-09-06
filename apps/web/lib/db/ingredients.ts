import prisma from "../prisma"; // Import Prisma client
import { Prisma } from "@prisma/client";

type ChatIngredientCatalogEntry = {
  id: number;
  name: string;
  sugar_content: Prisma.Decimal;
  category: string;
};

let chatIngredientCatalog: Promise<ChatIngredientCatalogEntry[]> | undefined;

function invalidateChatIngredientCatalog() {
  chatIngredientCatalog = undefined;
}

// Fetch all ingredients
export async function getAllIngredients() {
  try {
    return await prisma.ingredients.findMany();
  } catch (error) {
    console.error("Error fetching all ingredients:", error);
    throw new Error("Could not fetch ingredients");
  }
}

export async function getIngredientById(id: number) {
  try {
    return await prisma.ingredients.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error("Error fetching ingredient by ID:", error);
    throw new Error("Could not fetch ingredient by ID");
  }
}

// Fetch ingredients by category
export async function getIngredientsByCategory(category: string) {
  try {
    return await prisma.ingredients.findMany({
      where: {
        category: {
          equals: category,
          mode: "insensitive",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching ingredients by category:", error);
    throw new Error("Could not fetch ingredients by category");
  }
}

// Fetch ingredient by name
export async function getIngredientByName(name: string) {
  try {
    return await prisma.ingredients.findMany({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching ingredient by name:", error);
    throw new Error("Could not fetch ingredient by name");
  }
}

/**
 * The chatbot catalog is deliberately cached per warm server instance. It is
 * small enough to give the model the full list for semantic matching, and all
 * local create/update/delete paths invalidate the cache immediately.
 */
export async function getIngredientCatalogForChat() {
  try {
    chatIngredientCatalog ??= prisma.ingredients.findMany({
      select: {
        id: true,
        name: true,
        sugar_content: true,
        category: true,
      },
      orderBy: { name: "asc" },
    });
    return await chatIngredientCatalog;
  } catch (error) {
    chatIngredientCatalog = undefined;
    console.error("Error loading ingredients for chat:", error);
    throw new Error("Could not load ingredients");
  }
}

export async function createIngredient(data: {
  name: string;
  sugar_content: number;
  water_content: number;
  category: string;
}) {
  try {
    const ingredient = await prisma.ingredients.create({
      data,
    });
    invalidateChatIngredientCatalog();
    return ingredient;
  } catch (error) {
    if (!isIdUniqueConstraintError(error)) throw error;

    await prisma.$executeRaw`
      SELECT setval(
        pg_get_serial_sequence('ingredients', 'id'),
        COALESCE((SELECT MAX(id) FROM ingredients), 0) + 1,
        false
      )
    `;

    const ingredient = await prisma.ingredients.create({
      data,
    });
    invalidateChatIngredientCatalog();
    return ingredient;
  }
}

function isIdUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    (Array.isArray(error.meta?.target)
      ? error.meta.target.includes("id")
      : error.meta?.target === "id")
  );
}

export async function updateIngredient(
  id: string,
  fields: Partial<{
    name: string;
    sugar_content: number;
    water_content: number;
    category: string;
  }>,
) {
  const ingredient = await prisma.ingredients.update({
    where: { id: parseInt(id, 10) }, // Ensure id is converted to an integer
    data: fields,
  });
  invalidateChatIngredientCatalog();
  return ingredient;
}

export async function deleteIngredient(id: string) {
  const ingredient = await prisma.ingredients.delete({
    where: { id: Number(id) },
  });
  invalidateChatIngredientCatalog();
  return ingredient;
}
