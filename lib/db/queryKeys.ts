export const qk = {
  // Comments on a recipe
  comments: (recipeId: number) => ["comments", recipeId] as const,

  // Single recipe
  recipe: (id: string | number) => ["recipe", String(id)] as const,

  // List of public recipes
  recipesList: ["recipes"] as const,

  // Authenticated user (lightweight user info)
  authMe: ["auth", "me"] as const,

  // Full account info (user + recipes)
  accountInfo: ["auth", "account-info"] as const,

  ingredients: (category?: string) =>
    category
      ? (["ingredients", { category }] as const)
      : (["ingredients"] as const),

  additives: ["additives"] as const,
  yeasts: ["yeasts"] as const,

  // Hydrometer dashboard
  hydrometerInfo: ["hydrometer", "info"] as const,
  hydrometerBrews: ["hydrometer", "brews"] as const,

  // Logs for a device over a date range
  hydrometerDeviceLogs: (deviceId: string, start: string, end: string) =>
    ["hydrometer", "logs", "device", deviceId, { start, end }] as const,

  // Prefix used to invalidate *all* device log ranges
  hydrometerDeviceLogsPrefix: (deviceId: string) =>
    ["hydrometer", "logs", "device", deviceId] as const,

  // Logs for a brew (brewId → list of logs)
  hydrometerBrewLogs: (brewId: string) =>
    ["hydrometer", "logs", "brew", brewId] as const,

  // Prefix for invalidating all brew-log queries
  hydrometerBrewLogsPrefix: ["hydrometer", "logs", "brew"] as const
};
