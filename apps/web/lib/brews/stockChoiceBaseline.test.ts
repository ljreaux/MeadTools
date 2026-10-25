import assert from "node:assert/strict";
import test from "node:test";
import type { BrewInventoryContextResponse } from "@meadtools/api-contract/contracts";
import {
  captureStockChoiceBaseline,
  packagingEntryIdentity,
} from "./stockChoiceBaseline";
import { planEntryInventory } from "@meadtools/inventory-domain";
const entry = "e";
function context(quantity: number): BrewInventoryContextResponse {
  return {
    can_manage: true,
    tracked_entry_ids: [entry],
    vessel_events: [],
    usages: [
      {
        entry_id: entry,
        line_key: "bottle:0",
        line_name: "750 mL bottles",
        stock_id: "s",
        deducted: { value: quantity, unit: "units" },
        stock_archived: false,
        stock: {
          id: "s",
          name: "Bottles",
          category: "packaging",
          quantity: { value: 100 - quantity, unit: "units" },
          notes: null,
          catalogReference: null,
          reconciliation_required: false,
        },
      },
    ],
  };
}
test("two packaging saves rebase expected use after each successful write", () => {
  let baseline = captureStockChoiceBaseline(entry, context(6));
  const first = planEntryInventory({
    stocks: [context(6).usages[0].stock],
    lines: [
      {
        key: "bottle:0",
        name: "Bottles",
        kind: "PACKAGING",
        quantity: { value: 8, unit: "units" },
      },
    ],
    bindings: [{ line_key: "bottle:0", stock_id: "s" }],
    previous: baseline.uses,
  });
  assert.equal(first.balances[0].quantity.value, 92);
  const refreshed = context(8);
  // An unrelated refresh must leave the open edit's captured baseline intact.
  assert.equal(baseline.uses[0].deducted.value, 6);
  baseline = captureStockChoiceBaseline(entry, refreshed); // successful-save boundary
  const second = planEntryInventory({
    stocks: [refreshed.usages[0].stock],
    lines: [
      {
        key: "bottle:0",
        name: "Bottles",
        kind: "PACKAGING",
        quantity: { value: 10, unit: "units" },
      },
    ],
    bindings: [{ line_key: "bottle:0", stock_id: "s" }],
    previous: baseline.uses,
  });
  assert.equal(baseline.uses[0].deducted.value, 8);
  assert.equal(second.balances[0].quantity.value, 90);
});
test("first packaging creation replaces a pre-refresh untracked snapshot", () => {
  const empty = { usages: [], tracked_entry_ids: [] };
  let baseline = captureStockChoiceBaseline(entry, empty);
  assert.equal(baseline.tracked, false);
  baseline = captureStockChoiceBaseline(entry, context(6));
  assert.equal(baseline.tracked, true);
  assert.equal(baseline.uses[0].deducted.value, 6);
});

test("a lost first-create response keeps the pending packaging ID across retries", () => {
  const pending = { current: null as string | null };
  let generated = 0;
  const makeId = () => `entry-${++generated}`;
  const first = packagingEntryIdentity(pending, undefined, makeId);
  assert.equal(packagingEntryIdentity(pending, undefined, makeId), first);
  assert.equal(generated, 1);
  assert.equal(
    packagingEntryIdentity(pending, "saved-entry", makeId),
    "saved-entry",
  );
  pending.current = null; // rotate only after confirmed success
  assert.notEqual(packagingEntryIdentity(pending, undefined, makeId), first);
});
