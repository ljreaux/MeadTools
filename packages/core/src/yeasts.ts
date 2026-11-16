/** Yeast catalog helpers shared by the web yeast table and Mobile. */

export type YeastCatalogEntry = {
  name: string;
  brand: string;
  nitrogen_requirement: string;
  tolerance: string;
  low_temp: string;
  high_temp: string;
};

/** Nitrogen requirements from least to most demanding. */
export const NITROGEN_REQUIREMENT_ORDER = ["Very Low", "Low", "Medium", "High", "Very High"] as const;

/** Sort position of a nitrogen requirement; unknown values sort first, as on the web. */
export function nitrogenRequirementRank(requirement: string) {
  return (NITROGEN_REQUIREMENT_ORDER as readonly string[]).indexOf(requirement);
}

/** A catalog temperature (stored in °F) in the chosen scale; °C is rounded to whole degrees. */
export function yeastTemperature(fahrenheit: string, scale: "F" | "C") {
  const value = parseInt(fahrenheit, 10);
  return scale === "F" ? value : Math.round((value - 32) * (5 / 9));
}

export type YeastSortKey = "name" | "brand" | "nitrogen_requirement" | "tolerance" | "low_temp" | "high_temp";

/**
 * Filters by brand and by a case-insensitive search across every column, and
 * sorts like the web table: text alphabetically, nitrogen by requirement,
 * tolerance and temperatures numerically.
 */
export function filterAndSortYeasts<T extends YeastCatalogEntry>(
  yeasts: readonly T[],
  options: { query?: string; brand?: string | null; sort?: { key: YeastSortKey; descending?: boolean } | null }
): T[] {
  const query = options.query?.trim().toLowerCase() ?? "";
  const filtered = yeasts.filter((yeast) => {
    if (options.brand && yeast.brand !== options.brand) return false;
    if (!query) return true;
    return [yeast.name, yeast.brand, yeast.nitrogen_requirement, yeast.tolerance, yeast.low_temp, yeast.high_temp].some(
      (value) => value.toLowerCase().includes(query)
    );
  });
  const sort = options.sort;
  if (!sort) return filtered;

  const compare = (a: T, b: T) => {
    switch (sort.key) {
      case "nitrogen_requirement":
        return nitrogenRequirementRank(a.nitrogen_requirement) - nitrogenRequirementRank(b.nitrogen_requirement);
      case "tolerance":
      case "low_temp":
      case "high_temp":
        return parseFloat(a[sort.key]) - parseFloat(b[sort.key]);
      default:
        return a[sort.key].localeCompare(b[sort.key]);
    }
  };
  return [...filtered].sort((a, b) => (sort.descending ? -compare(a, b) : compare(a, b)));
}
