import prisma from "../prisma";

// Get all yeasts
export async function getAllYeasts() {
  try {
    return await prisma.yeasts.findMany();
  } catch (error) {
    console.error("Error fetching all yeasts:", error);
    throw new Error("Could not fetch yeasts");
  }
}

// Get yeasts by brand (case-insensitive)
export async function getYeastByBrand(brand: string) {
  try {
    return await prisma.yeasts.findMany({
      where: {
        brand: {
          equals: brand,
          mode: "insensitive",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching yeast by brand:", error);
    throw new Error("Could not fetch yeast by brand");
  }
}

// Get yeast by name (case-insensitive)
export async function getYeastByName(name: string) {
  try {
    return await prisma.yeasts.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching yeast by name:", error);
    throw new Error("Could not fetch yeast by name");
  }
}

// Get yeast by ID
export async function getYeastById(id: number) {
  try {
    return await prisma.yeasts.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error("Error fetching yeast by ID:", error);
    throw new Error("Could not fetch yeast by ID");
  }
}

export async function createYeast(data: {
  brand: string;
  name: string;
  nitrogen_requirement: string;
  tolerance: number;
  low_temp: number;
  high_temp: number;
}) {
  return prisma.yeasts.create({ data });
}

export async function updateYeast(
  id: string,
  fields: Partial<{
    brand: string;
    name: string;
    nitrogenRequirement: string;
    tolerance: number;
    lowTemp: number;
    highTemp: number;
  }>
) {
  return prisma.yeasts.update({
    where: { id: parseInt(id, 10) },
    data: fields,
  });
}

export async function deleteYeast(id: string) {
  return prisma.yeasts.delete({
    where: { id: parseInt(id, 10) },
  });
}
