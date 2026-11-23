import assert from "node:assert/strict";
import test from "node:test";
import {
  canUpdateRecipeSnapshot,
  recipeSnapshotChanges,
  recipeSnapshotContentKey,
  recipeSnapshotDiffers
} from "../src/recipe-snapshot-diff";

test("recipe snapshot comparison ignores visibility and object key order", () => {
  const before = {
    name: "Mead",
    dataV2: { ingredients: [{ lineId: "honey", amount: "2" }], flags: { private: false } }
  };
  const after = {
    name: "Mead",
    dataV2: { flags: { private: true }, ingredients: [{ amount: "2", lineId: "honey" }] }
  };
  assert.equal(recipeSnapshotContentKey(before), recipeSnapshotContentKey(after));
});

test("recipe snapshot comparison notices changed plans and names", () => {
  const before = { name: "Mead", dataV2: { ingredients: [{ amount: "2" }] } };
  assert.notEqual(
    recipeSnapshotContentKey(before),
    recipeSnapshotContentKey({ name: "Mead", dataV2: { ingredients: [{ amount: "3" }] } })
  );
  assert.notEqual(
    recipeSnapshotContentKey(before),
    recipeSnapshotContentKey({ name: "Melomel", dataV2: before.dataV2 })
  );
});

test("changed sections list the name first, then dataV2 sections in order", () => {
  const snapshot = {
    name: "Mead",
    dataV2: { ingredients: [{ amount: "2" }], fg: "1.000", notes: { primary: [] } }
  };
  const source = {
    name: "Melomel",
    dataV2: { notes: { primary: [] }, fg: "0.998", ingredients: [{ amount: "2" }], additives: [] }
  };
  assert.deepEqual(recipeSnapshotChanges(snapshot, source), ["name", "fg", "additives"]);
  assert.deepEqual(recipeSnapshotChanges(snapshot, snapshot), []);
  assert.equal(recipeSnapshotDiffers(snapshot, source), true);
  assert.equal(recipeSnapshotDiffers(snapshot, { ...snapshot }), false);
  assert.deepEqual(recipeSnapshotChanges({ name: "Mead", dataV2: null }, { name: "Mead" }), []);
});

test("only ongoing linked brews with a snapshot can update it", () => {
  const brew = { recipe_id: 2, recipe_snapshot: { name: "Mead" }, end_date: null, stage: "PRIMARY" };
  assert.equal(canUpdateRecipeSnapshot(brew), true);
  assert.equal(canUpdateRecipeSnapshot({ ...brew, recipe_id: null }), false);
  assert.equal(canUpdateRecipeSnapshot({ ...brew, recipe_snapshot: null }), false);
  assert.equal(canUpdateRecipeSnapshot({ ...brew, stage: "COMPLETE" }), false);
  assert.equal(canUpdateRecipeSnapshot({ ...brew, end_date: "2026-11-01T00:00:00.000Z" }), false);
});
