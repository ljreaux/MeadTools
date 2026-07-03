import prisma from "../prisma";

export const getIngredients = () => {
  return prisma.bjcpIngredient.findMany();
};

export async function createIngredients(
  data: {
    label: string;
    category: string;
    value: string;
  }[]
) {
  return prisma.bjcpIngredient.createMany({
    data,
    skipDuplicates: true, // optional: prevents errors on duplicates
  });
}
