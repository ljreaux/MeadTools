import prisma from "../prisma";
import { Prisma } from "@prisma/client";

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

/** Small, bounded fuzzy lookup for the server-side recipe assistant. */
export async function searchYeastsForChat(query: string) {
  try {
    const normalized = query.trim();
    const terms = normalized
      .split(/\s+/)
      .filter((term) => term.length >= 2)
      .slice(0, 5);
    const yeasts = await prisma.yeasts.findMany({
      where: {
        OR: [normalized, ...terms]
          .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
          .flatMap((value) => [
            { name: { contains: value, mode: "insensitive" as const } },
            { brand: { contains: value, mode: "insensitive" as const } }
          ])
      },
      take: 20
    });

    const lowerQuery = normalized.toLowerCase();
    return yeasts
      .sort((left, right) => {
        const leftExact = left.name.toLowerCase().includes(lowerQuery) ? 1 : 0;
        const rightExact = right.name.toLowerCase().includes(lowerQuery) ? 1 : 0;
        if (leftExact !== rightExact) return rightExact - leftExact;
        return `${left.brand} ${left.name}`.localeCompare(`${right.brand} ${right.name}`);
      })
      .slice(0, 10);
  } catch (error) {
    console.error("Error searching yeasts for chat:", error);
    throw new Error("Could not search yeasts");
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
  try {
    return await prisma.yeasts.create({ data });
  } catch (error) {
    if (!isIdUniqueConstraintError(error)) throw error;

    await prisma.$executeRaw`
      SELECT setval(
        pg_get_serial_sequence('yeasts', 'id'),
        COALESCE((SELECT MAX(id) FROM yeasts), 0) + 1,
        false
      )
    `;

    return prisma.yeasts.create({ data });
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
