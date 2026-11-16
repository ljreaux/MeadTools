import assert from "node:assert/strict";
import test from "node:test";
import {
  filterAndSortYeasts,
  nitrogenRequirementRank,
  yeastTemperature
} from "../src/yeasts";
import { convertJuiceServing, convertJuiceSugar } from "../src/extra-calculators";

const yeasts = [
  { name: "71B", brand: "Lalvin", nitrogen_requirement: "Low", tolerance: "14", low_temp: "59", high_temp: "86" },
  { name: "Kveik Yeast", brand: "Other", nitrogen_requirement: "Very High", tolerance: "16", low_temp: "68", high_temp: "104" },
  { name: "EC-1118", brand: "Lalvin", nitrogen_requirement: "Low", tolerance: "18", low_temp: "50", high_temp: "86" },
  { name: "M05", brand: "Mangrove Jack", nitrogen_requirement: "Medium", tolerance: "18", low_temp: "50", high_temp: "86" },
  { name: "Test", brand: "Other", nitrogen_requirement: "Very Low", tolerance: "9", low_temp: "60", high_temp: "70" }
];

test("yeast temperatures convert like the web table", () => {
  assert.equal(yeastTemperature("86", "F"), 86);
  assert.equal(yeastTemperature("86", "C"), 30);
  assert.equal(yeastTemperature("59", "C"), 15);
  assert.equal(yeastTemperature("104", "C"), 40);
});

test("nitrogen requirements keep the web order and place Very Low first", () => {
  assert.ok(nitrogenRequirementRank("Very Low") < nitrogenRequirementRank("Low"));
  assert.ok(nitrogenRequirementRank("Low") < nitrogenRequirementRank("Medium"));
  assert.ok(nitrogenRequirementRank("High") < nitrogenRequirementRank("Very High"));
  assert.equal(nitrogenRequirementRank("unknown"), -1);
});

test("search covers every column, case-insensitively, within a brand", () => {
  assert.deepEqual(filterAndSortYeasts(yeasts, { query: "ec-" }).map((y) => y.name), ["EC-1118"]);
  assert.deepEqual(filterAndSortYeasts(yeasts, { query: " mangrove " }).map((y) => y.name), ["M05"]);
  assert.deepEqual(filterAndSortYeasts(yeasts, { query: "104" }).map((y) => y.name), ["Kveik Yeast"]);
  assert.deepEqual(filterAndSortYeasts(yeasts, { brand: "Lalvin" }).map((y) => y.name), ["71B", "EC-1118"]);
  assert.deepEqual(filterAndSortYeasts(yeasts, { brand: "Lalvin", query: "71" }).map((y) => y.name), ["71B"]);
});

test("sorting is alphabetical, by requirement, or numeric", () => {
  const names = (key: Parameters<typeof filterAndSortYeasts>[1]["sort"]) =>
    filterAndSortYeasts(yeasts, { sort: key }).map((y) => y.name);
  assert.deepEqual(names({ key: "name" }), ["71B", "EC-1118", "Kveik Yeast", "M05", "Test"]);
  assert.deepEqual(names({ key: "nitrogen_requirement" }), ["Test", "71B", "EC-1118", "M05", "Kveik Yeast"]);
  assert.deepEqual(names({ key: "tolerance", descending: true }).slice(0, 2).sort(), ["EC-1118", "M05"]);
  assert.deepEqual(names({ key: "high_temp", descending: true })[0], "Kveik Yeast");
  assert.deepEqual(names({ key: "tolerance" })[0], "Test");
});

test("juice unit conversions match the web hook", () => {
  assert.equal(convertJuiceSugar(26, "g", "mg"), 26000);
  assert.equal(convertJuiceSugar(26000, "mg", "g"), 26);
  assert.equal(convertJuiceServing(240, "ml", "floz"), 8.1154);
  assert.equal(convertJuiceServing(8, "floz", "ml"), 236.588);
  assert.equal(convertJuiceServing(8, "floz", "floz"), 8);
});
