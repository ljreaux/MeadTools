import assert from "node:assert/strict";
import test from "node:test";
import {
  createBrewEntryRequestBodySchema,
  deleteBrewEntryRequestBodySchema,
  updateBrewEntryRequestBodySchema,
} from "../src/zod/brews";
import {
  acknowledgeBottlingChangeRequestBodySchema,
  brewInventoryContextResponseSchema,
  createFinishedMeadRequestBodySchema,
  updateFinishedMeadRequestBodySchema,
} from "../src/zod/inventory";
const uuid = "00000000-0000-4000-8000-000000000001";
test("legacy packaging writes remain valid and private bottling selections stay outside timeline data", () => {
  const old = {
    type: "PACKAGING",
    data: {
      packagedVolumeLiters: 5,
      bottleRows: [{ label: "750 mL", quantity: 6, sizeLiters: 0.75 }],
    },
  };
  assert.deepEqual(createBrewEntryRequestBodySchema.parse(old), old);
  const bottling = {
    operation_id: uuid,
    expected_revision: null,
    mode: "sync",
    outputs: [
      {
        row_id: uuid,
        quantity: 6,
        target: { kind: "existing", mead_id: uuid },
      },
    ],
  };
  const parsed = createBrewEntryRequestBodySchema.parse({ ...old, bottling });
  assert.deepEqual(parsed.data, old.data);
  assert.equal(parsed.bottling?.outputs[0].quantity, 6);
  assert.equal(
    updateBrewEntryRequestBodySchema.safeParse({
      bottling: {
        ...bottling,
        outputs: [{ ...bottling.outputs[0], quantity: 0.5 }],
      },
    }).success,
    false,
  );
  assert.equal(
    deleteBrewEntryRequestBodySchema.safeParse({
      bottling: { ...bottling, outputs: [] },
    }).success,
    true,
  );
  assert.equal(
    acknowledgeBottlingChangeRequestBodySchema.safeParse({
      operation_id: uuid,
      expected_revision: "a".repeat(64),
      confirmed_on_hand: false,
    }).success,
    false,
  );
});
test("older brew contexts can be read while new contexts retain explicit bottling provenance", () => {
  const old = {
    can_manage: false,
    tracked_entry_ids: [],
    usages: [],
    vessel_events: [],
  };
  assert.deepEqual(brewInventoryContextResponseSchema.parse(old), {
    ...old,
    brew_name: null,
    bottlings: [],
  });
});

test("finished bottle contracts retain entered size and disallow relabeling during count corrections", () => {
  const mead = { name: "Mixed bottles", bottles: [{ size_liters: .354882, quantity: 6,
    display_size: { value: 12, unit: "fl_oz" } }] };
  assert.deepEqual(createFinishedMeadRequestBodySchema.parse({ operation_id: uuid, mead }).mead.bottles, mead.bottles);
  const change = { operation_id: uuid, expected_revision: "a".repeat(64), action: "receipt",
    size_liters: .354882, quantity: 2, display_size: { value: 12, unit: "fl_oz" } };
  assert.equal(updateFinishedMeadRequestBodySchema.safeParse(change).success, true);
  assert.equal(updateFinishedMeadRequestBodySchema.safeParse({ ...change, action: "correction" }).success, false);
});
