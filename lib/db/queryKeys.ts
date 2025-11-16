export const qk = {
  comments: (recipeId: number) => ["comments", recipeId] as const,
  recipe: (id: string) => ["recipe", id],
  recipesList: ["recipes"]
};
