import { calculateRecipeDerivedState, type RecipeDerivedState } from "@meadtools/core/derived";
import { parseNumber } from "@meadtools/core/numeric";
import type { RecipeDataV2 } from "@meadtools/schemas";

/**
 * The headline numbers for a saved recipe. Each value is `null` when the
 * recipe does not have enough data for that estimate yet.
 */
export type RecipeSummary = {
  og: number | null;
  fg: number | null;
  finishedGravity: number | null;
  abv: number | null;
  bottlingVolume: number | null;
  volumeUnit: string;
};

const positive = (value: number) => (Number.isFinite(value) && value > 0 ? value : null);

export function summarizeDerivedRecipe(data: RecipeDataV2, derived: RecipeDerivedState): RecipeSummary {
  const fg = positive(parseNumber(data.fg));
  const hasPrimaryVolume = positive(derived.primaryVolumeL) !== null;
  const bottlingVolume = positive(derived.bottlingVolume);

  return {
    og: hasPrimaryVolume ? positive(derived.ogPrimary) : null,
    fg,
    finishedGravity: bottlingVolume !== null && fg !== null ? positive(derived.backsweetenedFg) : null,
    abv: hasPrimaryVolume && fg !== null && Number.isFinite(derived.abv) ? derived.abv : null,
    bottlingVolume,
    volumeUnit: derived.volumeUnit
  };
}

// List rows are recycled as the user scrolls a long list. Cache by the parsed
// recipe object so each recipe is calculated once per fetch, not per render.
const summaries = new WeakMap<RecipeDataV2, RecipeSummary | null>();

export function summarizeRecipe(data: RecipeDataV2 | null | undefined): RecipeSummary | null {
  if (!data) return null;
  if (summaries.has(data)) return summaries.get(data) ?? null;

  let summary: RecipeSummary | null;
  try {
    summary = summarizeDerivedRecipe(data, calculateRecipeDerivedState(data));
  } catch {
    // An incomplete or unusual recipe still lists by name.
    summary = null;
  }
  summaries.set(data, summary);
  return summary;
}

export const RECIPE_SORTS = ["newest", "name"] as const;
export type RecipeSort = (typeof RECIPE_SORTS)[number];

type ListableRecipe = { id: number; name: string };

/**
 * Filters saved recipes by name and orders them. "newest" uses the recipe id,
 * which increases as recipes are created.
 */
export function queryRecipeList<T extends ListableRecipe>(
  recipes: readonly T[],
  {
    search,
    sort,
    locale,
    fallbackName
  }: { search: string; sort: RecipeSort; locale: string; fallbackName: string }
): T[] {
  const displayName = (recipe: T) => recipe.name.trim() || fallbackName;
  const term = search.trim().toLocaleLowerCase(locale);
  const matches = term
    ? recipes.filter((recipe) => displayName(recipe).toLocaleLowerCase(locale).includes(term))
    : [...recipes];

  if (sort === "name") {
    const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
    return matches.sort((a, b) => collator.compare(displayName(a), displayName(b)) || b.id - a.id);
  }
  return matches.sort((a, b) => b.id - a.id);
}
