import Fuse from "fuse.js";

import type { BrewStage, DateValue } from "./projection";
import { isActiveBrew } from "./projection";

/** The fields a brew list needs to filter, search and sort. */
export type BrewListFilterItem = {
  id: string;
  name: string | null;
  start_date: DateValue;
  end_date: DateValue | null;
  stage: string;
  recipe_id: number | null;
  recipe_name: string | null;
};

export type BrewListStatus = "active" | "completed" | "all";
export type BrewListStageFilter = BrewStage | "all";
export type BrewListRecipeFilter = number | "all" | "none";
export type BrewListSortKey = "start_date" | "end_date";
export type BrewListSortDirection = "asc" | "desc";
export type BrewListSort = {
  key: BrewListSortKey;
  direction: BrewListSortDirection;
};

export type BrewListFilters = {
  /** Completed means ended or in the Complete stage (`isActiveBrew`). */
  status?: BrewListStatus;
  stage?: BrewListStageFilter;
  recipe?: BrewListRecipeFilter;
};

export type BrewListQuery = BrewListFilters & {
  search?: string;
  /** Null keeps the server's order. */
  sort?: BrewListSort | null;
};

export type BrewRecipeOption = { id: number; name: string };

/** Fields matched by brew list search, shared with the web account list. */
export const BREW_LIST_SEARCH_KEYS = [
  "name",
  "id",
  "recipe_name",
  "stage"
] as const;

const SEARCH_THRESHOLD = 0.4;

function dateTime(value: DateValue | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function matchesBrewListFilters(
  brew: BrewListFilterItem,
  { status = "all", stage = "all", recipe = "all" }: BrewListFilters
): boolean {
  if (status !== "all") {
    const active = isActiveBrew({
      end_date: brew.end_date === null ? null : String(brew.end_date),
      stage: brew.stage as BrewStage
    });
    if ((status === "active") !== active) return false;
  }
  if (stage !== "all" && brew.stage !== stage) return false;
  if (recipe === "none") return !brew.recipe_id;
  if (recipe !== "all" && brew.recipe_id !== recipe) return false;
  return true;
}

export function filterBrewList<T extends BrewListFilterItem>(
  brews: readonly T[],
  filters: BrewListFilters
): T[] {
  return brews.filter((brew) => matchesBrewListFilters(brew, filters));
}

/** Fuzzy search with the web list's keys and threshold; blank keeps the order. */
export function searchBrewList<T extends BrewListFilterItem>(
  brews: readonly T[],
  search: string
): T[] {
  if (!search) return [...brews];
  return new Fuse([...brews], {
    keys: [...BREW_LIST_SEARCH_KEYS],
    threshold: SEARCH_THRESHOLD
  })
    .search(search)
    .map((result) => result.item);
}

/** A missing date (an ongoing brew's end date) counts as the latest: first when newest first, last when oldest first. */
export function compareBrewListDates(sort: BrewListSort) {
  return (a: BrewListFilterItem, b: BrewListFilterItem) => {
    const aTime = dateTime(a[sort.key]);
    const bTime = dateTime(b[sort.key]);

    if (aTime === null && bTime === null) return 0;
    if (aTime === null) return sort.direction === "asc" ? 1 : -1;
    if (bTime === null) return sort.direction === "asc" ? -1 : 1;

    return sort.direction === "asc" ? aTime - bTime : bTime - aTime;
  };
}

/** Filter, then search, then sort, as the web account brew list does. */
export function queryBrewList<T extends BrewListFilterItem>(
  brews: readonly T[],
  { search = "", sort = null, ...filters }: BrewListQuery
): T[] {
  const results = searchBrewList(filterBrewList(brews, filters), search);
  return sort ? results.sort(compareBrewListDates(sort)) : results;
}

/** Recipes linked from the given brews, by name, for a recipe filter. */
export function brewListRecipeOptions(
  brews: readonly Pick<BrewListFilterItem, "recipe_id" | "recipe_name">[]
): BrewRecipeOption[] {
  const recipes = new Map<number, string>();
  for (const brew of brews) {
    if (brew.recipe_id) {
      recipes.set(brew.recipe_id, brew.recipe_name || String(brew.recipe_id));
    }
  }
  return Array.from(recipes, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/** Clicking the active column flips its direction; a new column starts newest first. */
export function nextBrewListSort(
  current: BrewListSort | null,
  key: BrewListSortKey
): BrewListSort {
  if (current?.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: "desc" };
}
