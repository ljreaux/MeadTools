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

/**
 * The catalog is small enough to rank locally. Normalizing punctuation makes
 * common label spellings such as EC-1118/EC1118 and US-05/US05 resolve to the
 * stored strain instead of making the assistant ask the brewer again.
 */
export async function searchYeastsForChat(query: string) {
  try {
    const normalized = normalizeYeastLookup(query);
    if (!normalized) return [];
    const yeasts = await prisma.yeasts.findMany();
    return yeasts
      .sort((left, right) => {
        const scoreDifference = yeastLookupScore(right, normalized) - yeastLookupScore(left, normalized);
        if (scoreDifference !== 0) return scoreDifference;
        return `${left.brand} ${left.name}`.localeCompare(`${right.brand} ${right.name}`);
      })
      .filter((yeast) => yeastLookupScore(yeast, normalized) > 0)
      .slice(0, 10);
  } catch (error) {
    console.error("Error searching yeasts for chat:", error);
    throw new Error("Could not search yeasts");
  }
}

function normalizeYeastLookup(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function yeastLookupScore(
  yeast: { name: string; brand: string },
  query: string
): number {
  const name = normalizeYeastLookup(yeast.name);
  const brand = normalizeYeastLookup(yeast.brand);
  const combined = `${brand}${name}`;
  // Lalvin commonly markets strains such as ICV D47 as simply “Lalvin D47”.
  // Treat the ICV prefix as an optional catalog label, while retaining the
  // stored canonical strain name in the returned result.
  const nameWithoutIcv = name.replace(/^icv/, "");
  const combinedWithoutIcv = `${brand}${nameWithoutIcv}`;
  if (name === query || combined === query) return 100;
  if (nameWithoutIcv === query || combinedWithoutIcv === query) return 95;
  if (name.includes(query)) return 80;
  if (nameWithoutIcv.includes(query) || combinedWithoutIcv.includes(query)) return 75;
  if (combined.includes(query)) return 70;
  if (query.includes(name) && name.length >= 3) return 60;
  const queryTokens = query.match(/[a-z]+|\d+/g) ?? [];
  return queryTokens.some((token) => token.length >= 2 && combined.includes(token)) ? 10 : 0;
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
