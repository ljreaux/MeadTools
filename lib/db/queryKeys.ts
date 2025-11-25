export const qk = {
  // Comments on a recipe
  comments: (recipeId: number) => ["comments", recipeId] as const,

  // Single recipe
  recipe: (id: string | number) => ["recipe", String(id)] as const,

  // List of public recipes
  recipesList: ["recipes"] as const,

  // Authenticated user (lightweight user info)
  authMe: ["auth", "me"] as const,

  // Full account info (user + recipes from /api/auth/account-info)
  accountInfo: ["auth", "account-info"] as const,

  ingredients: ["ingredients"] as const,
  additives: ["additives"] as const,

  // Hydrometer dashboard
  hydrometerInfo: ["hydrometer", "info"] as const
};
