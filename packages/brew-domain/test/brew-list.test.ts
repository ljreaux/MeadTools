import assert from "node:assert/strict";
import test from "node:test";

import {
  brewListRecipeOptions,
  compareBrewListDates,
  filterBrewList,
  nextBrewListSort,
  queryBrewList,
  searchBrewList,
  type BrewListFilterItem
} from "../src/brew-list";

const brew = (
  id: string,
  overrides: Partial<BrewListFilterItem> = {}
): BrewListFilterItem => ({
  id,
  name: null,
  start_date: "2026-01-01T00:00:00.000Z",
  end_date: null,
  stage: "PRIMARY",
  recipe_id: null,
  recipe_name: null,
  ...overrides
});

const brews = [
  brew("a", {
    name: "Spring traditional",
    start_date: "2026-03-01T00:00:00.000Z",
    recipe_id: 2,
    recipe_name: "Traditional"
  }),
  brew("b", {
    name: "Cherry melomel",
    start_date: "2025-06-01T00:00:00.000Z",
    end_date: "2025-12-01T00:00:00.000Z",
    stage: "PACKAGED",
    recipe_id: 1,
    recipe_name: "Melomel"
  }),
  brew("c", {
    name: "Bochet",
    start_date: "2025-01-01T00:00:00.000Z",
    stage: "COMPLETE"
  }),
  brew("d", {
    name: "Planned cyser",
    start_date: new Date("2026-02-01T00:00:00.000Z"),
    stage: "PLANNED",
    recipe_id: 2,
    recipe_name: "Traditional"
  })
];

const ids = (list: readonly BrewListFilterItem[]) => list.map((item) => item.id);

test("status separates active brews from ended or complete ones", () => {
  assert.deepEqual(ids(filterBrewList(brews, { status: "active" })), ["a", "d"]);
  assert.deepEqual(ids(filterBrewList(brews, { status: "completed" })), ["b", "c"]);
  assert.deepEqual(ids(filterBrewList(brews, { status: "all" })), ["a", "b", "c", "d"]);
  assert.deepEqual(ids(filterBrewList(brews, {})), ["a", "b", "c", "d"]);
});

test("stage and recipe filters match the web list", () => {
  assert.deepEqual(ids(filterBrewList(brews, { stage: "PACKAGED" })), ["b"]);
  assert.deepEqual(ids(filterBrewList(brews, { recipe: 2 })), ["a", "d"]);
  assert.deepEqual(ids(filterBrewList(brews, { recipe: "none" })), ["c"]);
  assert.deepEqual(
    ids(filterBrewList(brews, { status: "active", recipe: 2, stage: "PLANNED" })),
    ["d"]
  );
});

test("search matches names, recipes and stages; blank keeps the order", () => {
  assert.deepEqual(ids(searchBrewList(brews, "")), ["a", "b", "c", "d"]);
  assert.deepEqual(ids(searchBrewList(brews, "cherry")), ["b"]);
  assert.deepEqual(ids(searchBrewList(brews, "melomel")).sort(), ["b"]);
  assert.ok(ids(searchBrewList(brews, "PACKAGED")).includes("b"));
  assert.deepEqual(ids(searchBrewList(brews, "zzzzzz")), []);
});

test("date sort treats a missing end date as the latest", () => {
  const byEndDesc = [...brews].sort(
    compareBrewListDates({ key: "end_date", direction: "desc" })
  );
  assert.equal(byEndDesc.at(-1)?.id, "b");
  const byEndAsc = [...brews].sort(
    compareBrewListDates({ key: "end_date", direction: "asc" })
  );
  assert.equal(byEndAsc[0]?.id, "b");

  assert.deepEqual(
    ids([...brews].sort(compareBrewListDates({ key: "start_date", direction: "desc" }))),
    ["a", "d", "b", "c"]
  );
});

test("queryBrewList filters, searches and sorts without mutating input", () => {
  const input = [...brews];
  const result = queryBrewList(input, {
    status: "all",
    recipe: 2,
    sort: { key: "start_date", direction: "asc" }
  });
  assert.deepEqual(ids(result), ["d", "a"]);
  assert.deepEqual(ids(input), ["a", "b", "c", "d"]);
  assert.deepEqual(ids(queryBrewList(input, { status: "active" })), ["a", "d"]);
});

test("recipe options are unique and sorted by name", () => {
  assert.deepEqual(brewListRecipeOptions(brews), [
    { id: 1, name: "Melomel" },
    { id: 2, name: "Traditional" }
  ]);
  assert.deepEqual(brewListRecipeOptions([{ recipe_id: 9, recipe_name: null }]), [
    { id: 9, name: "9" }
  ]);
});

test("sort toggles direction on the same key and starts new keys descending", () => {
  assert.deepEqual(nextBrewListSort(null, "start_date"), {
    key: "start_date",
    direction: "desc"
  });
  assert.deepEqual(
    nextBrewListSort({ key: "start_date", direction: "desc" }, "start_date"),
    { key: "start_date", direction: "asc" }
  );
  assert.deepEqual(
    nextBrewListSort({ key: "start_date", direction: "asc" }, "end_date"),
    { key: "end_date", direction: "desc" }
  );
});
