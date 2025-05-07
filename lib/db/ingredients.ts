import prisma from "../prisma"; // Import Prisma client

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
export async function createIngredient(data: {
  name: string;
  sugar_content: number;
  water_content: number;
  category: string;
}) {
  return prisma.ingredients.create({
    data,
  });
}

export async function updateIngredient(
  id: string,
  fields: Partial<{
    name: string;
    sugar_content: number;
    water_content: number;
    category: string;
  }>
) {
  return prisma.ingredients.update({
    where: { id: parseInt(id, 10) }, // Ensure id is converted to an integer
    data: fields,
  });
}

export async function deleteIngredient(id: string) {
  return prisma.ingredients.delete({
    where: { id: Number(id) },
  });
}
