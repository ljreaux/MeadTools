import assert from "node:assert/strict";
import test from "node:test";

import { entryPayload } from "../src/entry-payload";

test("entryPayload preserves note, tasting, and issue defaults", () => {
  assert.deepEqual(entryPayload.note("Remember this"), {
    type: "NOTE",
    title: null,
    note: "Remember this",
    data: null,
    datetime: undefined
  });
  assert.equal(entryPayload.tasting("Bright acidity").title, "Tasting");
  assert.equal(entryPayload.issue("Stalled").title, "Issue");
});

test("entryPayload preserves gravity roles and source metadata", () => {
  assert.deepEqual(
    entryPayload.gravity(1.1, "Initial reading", {
      readingRole: "OG",
      source: "recipe",
      recipeValue: 1.098,
      datetime: "2026-07-03T12:00:00.000Z"
    }),
    {
      type: "GRAVITY",
      title: "Original gravity",
      datetime: "2026-07-03T12:00:00.000Z",
      gravity: 1.1,
      data: {
        readingRole: "OG",
        source: "recipe",
        recipeValue: 1.098,
        hidden: undefined,
        nutrientBasis: undefined,
        abvEstimate: undefined,
        display: undefined
      },
      note: "Initial reading"
    }
  );
});

test("entryPayload preserves measurement and packaging shapes", () => {
  assert.deepEqual(entryPayload.temperature(68, "F"), {
    type: "TEMPERATURE",
    title: "Temperature check",
    datetime: undefined,
    temperature: 68,
    temp_units: "F",
    note: null
  });
  assert.deepEqual(entryPayload.ph(3.4), {
    type: "PH",
    title: "pH reading",
    datetime: undefined,
    note: null,
    data: { ph: 3.4 }
  });
  assert.equal(
    entryPayload.packaging({
      packagedVolumeLiters: 18,
      bottleRows: [
        {
          label: "375 mL",
          quantity: 48,
          sizeLiters: 0.375,
          totalLiters: 18
        }
      ]
    }).type,
    "PACKAGING"
  );
});

test("entryPayload preserves addition linking and ABV estimates", () => {
  const addition = entryPayload.addition({
    name: "Oak",
    kind: "OTHER",
    source: "recipe_additive",
    amount: 10,
    unit: "g",
    recipeAdditiveId: "oak-1"
  });
  assert.equal(addition.type, "ADDITION");
  assert.equal(addition.title, "Oak");
  assert.deepEqual(addition.data, {
    kind: "OTHER",
    source: "recipe_additive",
    name: "Oak",
    amount: 10,
    unit: "g",
    recipeIngredientId: undefined,
    recipeAdditiveId: "oak-1",
    meta: undefined
  });

  const estimate = entryPayload.abvEstimate({
    abv: 12.5,
    og: 1.1,
    fg: 1.01,
    ogEntryId: "og",
    fgEntryId: "fg"
  });
  assert.equal(estimate.type, "GRAVITY");
  assert.equal(estimate.gravity, 12.5);
  assert.equal(estimate.data?.source, "abv_estimate");
  assert.equal(estimate.data?.hidden, true);
});
