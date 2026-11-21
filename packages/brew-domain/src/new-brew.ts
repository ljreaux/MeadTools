import Fuse from "fuse.js";

/** A recipe a brew can start from. */
export type NewBrewRecipeOption = { id: number; name: string };

const SEARCH_THRESHOLD = 0.4;

/** Fuzzy recipe search with the web New Brew page's settings; blank keeps the order. */
export function searchNewBrewRecipes<T extends NewBrewRecipeOption>(
  recipes: readonly T[],
  search: string
): T[] {
  const query = search.trim();
  if (!query) return [...recipes];
  return new Fuse([...recipes], { keys: ["name"], threshold: SEARCH_THRESHOLD })
    .search(query)
    .map((result) => result.item);
}

/** The name a new brew is created with: the typed name, or the recipe's name when blank. */
export function newBrewName(draft: string, recipeName: string): string {
  return draft.trim() || recipeName;
}
