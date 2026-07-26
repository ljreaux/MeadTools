type TranslationResource = Record<string, unknown>;

/**
 * Produces conservative spelling variants for catalog search. It covers the
 * common English and German plural endings used by the current supported
 * locales; catalog aliases provide the cross-language name mapping.
 */
export function ingredientSearchTerms(query: string): string[] {
  const normalized = query.trim();
  const tokenVariants = normalized
    .match(/\p{L}+/gu)
    ?.filter((token) => token.length >= 3)
    .flatMap((token) => singularIngredientSearchTerms(token)) ?? [];
  return [...singularIngredientSearchTerms(normalized), ...tokenVariants].filter(
    (value, index, values) => values.indexOf(value) === index
  );
}

function singularIngredientSearchTerms(normalized: string): string[] {
  const lowerCased = normalized.toLocaleLowerCase();
  if (lowerCased.endsWith("ies")) {
    return [normalized, `${normalized.slice(0, -3)}y`];
  }
  if (lowerCased.endsWith("en")) {
    return [normalized, normalized.slice(0, -1)];
  }
  if (lowerCased.endsWith("es")) {
    return [normalized, normalized.slice(0, -2)];
  }
  if (lowerCased.endsWith("s")) {
    return [normalized, normalized.slice(0, -1)];
  }
  return normalized ? [normalized] : [];
}

/** Resolve a localized catalog display name back to its canonical catalog term. */
export function canonicalIngredientSearchTerms(
  query: string,
  canonicalResource: TranslationResource,
  localizedResources: TranslationResource[]
): string[] {
  const queryTerms = new Set(ingredientSearchTerms(query).map(normalizeIngredientSearchTerm));
  const matches = new Set<string>();
  for (const [key, canonical] of Object.entries(canonicalResource)) {
    if (typeof canonical !== "string") continue;
    const localizedValues = [canonical, ...localizedResources.map((resource) => resource[key])];
    if (
      localizedValues.some(
        (value) =>
          typeof value === "string" &&
          ingredientSearchTerms(value).some((term) => queryTerms.has(normalizeIngredientSearchTerm(term)))
      )
    ) {
      matches.add(canonical);
    }
  }
  return [...matches];
}

function normalizeIngredientSearchTerm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}
