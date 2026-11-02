import assert from "node:assert/strict";
import test from "node:test";
import { recipeSnapshotContentKey } from "@/lib/brews/recipeSnapshot";

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
