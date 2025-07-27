import prisma from "../prisma";

export const getIngredients = () => {
  return prisma.bjcpIngredient.findMany();
};

export async function createIngredient(data: {
  label: string;
  category: string;
  value: string;
}) {
  return prisma.bjcpIngredient.create({
    data,
  });
}
