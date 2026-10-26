import assert from "node:assert/strict";
import test from "node:test";
import { finishedMeadInputSchema, finishedMeadTotals } from "../src/finished-mead";

test("finished meads accept user-chosen groupings and several sizes without a brew or lot", () => {
  const mead = finishedMeadInputSchema.parse({ name: "House traditional", bottles: [
    { size_liters: 0.75, quantity: 10 }, { size_liters: 0.375, quantity: 4 },
  ] });
  assert.deepEqual(finishedMeadTotals(mead.bottles), { bottles: 14, liters: 9 });
  assert.equal(mead.notes, null);
});
test("finished counts require whole bottles, positive capacities and distinct sizes", () => {
  for (const bottles of [[], [{ size_liters: 0, quantity: 2 }], [{ size_liters: 0.75, quantity: 1.5 }],
    [{ size_liters: 0.75, quantity: -1 }], [{ size_liters: 0.75, quantity: 2 }, { size_liters: 0.75, quantity: 3 }]])
    assert.equal(finishedMeadInputSchema.safeParse({ name: "Traditional", bottles }).success, false);
  assert.ok(finishedMeadInputSchema.safeParse({ name: "Waiting for more bottles", bottles: [{ size_liters: 0.75, quantity: 0 }] }).success);
});
