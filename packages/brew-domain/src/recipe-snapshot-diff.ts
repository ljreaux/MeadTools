/** The parts of a recipe a brew snapshot is compared on. */
export type RecipeSnapshotContent = {
  name?: string | null;
  dataV2?: unknown;
};

/** The dataV2 sections the snapshot update dialog lists when they change. */
export const RECIPE_SNAPSHOT_SECTIONS = [
  "unitDefaults",
  "ingredients",
  "fg",
  "additives",
  "notes",
  "nutrients",
  "stabilizers",
  "lossAdjustment"
] as const;

export type RecipeSnapshotSection = (typeof RECIPE_SNAPSHOT_SECTIONS)[number];
export type RecipeSnapshotChange = "name" | RecipeSnapshotSection;

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

/**
 * A stable key for the recipe plan: name and dataV2 with object keys sorted.
 * Visibility is a permission, not a recipe-plan change, so `private` is ignored.
 */
export function recipeSnapshotContentKey(value: RecipeSnapshotContent): string {
  return JSON.stringify(canonical({ name: value.name, dataV2: value.dataV2 }));
}

export function recipeSnapshotDiffers(
  snapshot: RecipeSnapshotContent,
  source: RecipeSnapshotContent
): boolean {
  return recipeSnapshotContentKey(snapshot) !== recipeSnapshotContentKey(source);
}

function section(dataV2: unknown, key: RecipeSnapshotSection): unknown {
  return dataV2 && typeof dataV2 === "object"
    ? (dataV2 as Record<string, unknown>)[key]
    : undefined;
}

/** Which parts of the plan changed since the snapshot, in display order. */
export function recipeSnapshotChanges(
  snapshot: RecipeSnapshotContent,
  source: RecipeSnapshotContent
): RecipeSnapshotChange[] {
  const changes: RecipeSnapshotChange[] = snapshot.name !== source.name ? ["name"] : [];
  for (const key of RECIPE_SNAPSHOT_SECTIONS) {
    if (
      recipeSnapshotContentKey({ dataV2: section(snapshot.dataV2, key) }) !==
      recipeSnapshotContentKey({ dataV2: section(source.dataV2, key) })
    ) {
      changes.push(key);
    }
  }
  return changes;
}

/** Only ongoing brews linked to a recipe, with a snapshot, can update it. */
export function canUpdateRecipeSnapshot(brew: {
  recipe_id: number | null;
  recipe_snapshot: unknown;
  end_date: string | null;
  stage: string;
}): boolean {
  return Boolean(
    brew.recipe_id && brew.recipe_snapshot && !brew.end_date && brew.stage !== "COMPLETE"
  );
}
