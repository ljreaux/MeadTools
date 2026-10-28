import { inventoryEntryLines } from "../src/entry-lines";
import assert from "node:assert/strict";
import test from "node:test";
import {
  bottlingSelectionSchema,
  productionBottleRows,
  validateBottlingOutputs,
  productionDifference,
} from "../src/bottling";
const row = "00000000-0000-4000-8000-000000000001",
  mead = "00000000-0000-4000-8000-000000000002";
test("bottling splits only whole confirmed bottles, independent of estimated volume", () => {
  const rows = productionBottleRows({
    packagedVolumeLiters: 99,
    bottleRows: [{ id: row, label: "750 mL", quantity: 12, sizeLiters: 0.75 }],
  });
  const output = {
    row_id: row,
    quantity: 6,
    target: { kind: "existing" as const, mead_id: mead },
    location_id: null,
    position: "",
  };
  validateBottlingOutputs(rows, [output, output]);
  assert.throws(() =>
    validateBottlingOutputs(rows, [output, { ...output, quantity: 7 }]),
  );
  assert.throws(() =>
    productionBottleRows({
      bottleRows: [{ id: row, label: "a", quantity: 1.5, sizeLiters: 0.75 }],
    }),
  );
  assert.throws(() =>
    productionBottleRows({
      bottleRows: [
        { id: row, label: "a", quantity: 1, sizeLiters: 0.75 },
        { id: row, label: "b", quantity: 2, sizeLiters: 0.375 },
      ],
    }),
  );
  assert.equal(
    bottlingSelectionSchema.safeParse({
      operation_id: row,
      expected_revision: null,
      mode: "sync",
      outputs: [{ ...output, quantity: 0.5 }],
    }).success,
    false,
  );
});
test("bottling corrections preserve later use, receipts, and exact retries", () => {
  assert.deepEqual(productionDifference(8, 12, 10), {
    balance: { value: 6, unit: "units" },
    adjustment: -2,
  });
  assert.deepEqual(productionDifference(8, 12, 12), {
    balance: { value: 8, unit: "units" },
    adjustment: 0,
  });
  assert.throws(() => productionDifference(2, 12, 0));
  assert.throws(() => productionDifference(1_000_000_000, 0, 1));
});

test("bottle and closure row identities survive reordering while legacy keys remain readable", () => {
  const first = { id: row, name: "Corks", quantity: 2 },
    second = { id: mead, name: "Caps", quantity: 3 };
  const data = {
    bottleRows: [{ id: row, label: "750 mL", quantity: 2, sizeLiters: 0.75 }],
    closures: [first, second],
  };
  const before = inventoryEntryLines("PACKAGING", data);
  const after = inventoryEntryLines("PACKAGING", {
    ...data,
    closures: [second, first],
  });
  assert.equal(
    before.find((line) => line.name === "Corks")?.key,
    after.find((line) => line.name === "Corks")?.key,
  );
  assert.equal(before[0].key, `bottle:${row}`);
  assert.equal(
    inventoryEntryLines("PACKAGING", {
      closures: [{ name: "Caps", quantity: 2 }],
    })[0].key,
    "closure:0",
  );
});

test("packaging inventory lines retain selected bottle units", () => {
  const data = { bottleRows: [{ id: row, label: "12oz", quantity: 2, sizeLiters: 0.355 },
    { id: mead, label: "Custom", quantity: 1, sizeLiters: 0.710086, customSizeValue: 24, customSizeUnits: "fl_oz" }] };
  assert.equal(inventoryEntryLines("PACKAGING", data)[0].name, "12 fl oz bottles");
  assert.equal(inventoryEntryLines("PACKAGING", data)[1].name, "24 fl oz bottles");
  assert.equal(productionBottleRows(data)[1].customSizeUnits, "fl_oz");
});
