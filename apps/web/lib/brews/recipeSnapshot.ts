export type RecipeSnapshotContent = {
  name?: string | null;
  dataV2?: unknown;
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "private")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)])
    );
  }
  return value;
}

/** Visibility is a permission, not a recipe-plan change. */
export function recipeSnapshotContentKey(value: RecipeSnapshotContent): string {
  return JSON.stringify(canonical({ name: value.name, dataV2: value.dataV2 }));
}
