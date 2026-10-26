import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultInventoryView,
  inventoryViewSchema,
  organizeInventory,
  inventoryLocationPaths,
  planStorageReduction,
  validateAllocationTotal,
  type OrganizedInventoryItem,
} from "../src/organization";
const labelA = "00000000-0000-4000-8000-000000000001",
  labelB = "00000000-0000-4000-8000-000000000002";
const item = (
  id: string,
  name: string,
  labels: string[],
  amount: number,
): OrganizedInventoryItem => ({
  id,
  name,
  labels,
  labelNames: labels,
  notes: null,
  type: "honey",
  locations: [],
  locationNames: [],
  quantity: { value: amount, unit: "kg" },
  volume: 0,
  bottleSize: 0,
});
test("category pills match any or all independently of multiple ordered sorting rules", () => {
  const rows = [
    item("a", "B", [labelA], 5),
    item("b", "A", [labelA, labelB], 5),
    item("c", "C", [labelB], 2),
  ];
  const view = inventoryViewSchema.parse({
    ...defaultInventoryView,
    labels: [labelA, labelB],
    sorts: [
      { field: "amount", direction: "desc" },
      { field: "name", direction: "asc" },
    ],
  });
  assert.deepEqual(
    organizeInventory(rows, view).map((row) => row.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    organizeInventory(rows, { ...view, label_match: "all" }).map(
      (row) => row.id,
    ),
    ["b"],
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ["a", "b", "c"],
  );
});
test("amount sorting converts compatible units and stable ties do not depend on incoming order", () => {
  const small = item("small", "A", [], 500);
  small.quantity.unit = "g";
  const large = item("large", "B", [], 1);
  assert.deepEqual(
    organizeInventory([large, small], {
      ...defaultInventoryView,
      sorts: [{ field: "amount", direction: "asc" }],
    }).map((row) => row.id),
    ["small", "large"],
  );
  assert.equal(
    inventoryViewSchema.safeParse({
      ...defaultInventoryView,
      sorts: [
        { field: "name", direction: "asc" },
        { field: "name", direction: "desc" },
      ],
    }).success,
    false,
  );
});
test("nested storage paths reject cycles and deductions use unlocated quantity before positions", () => {
  assert.equal(
    inventoryLocationPaths([
      { id: "room", name: "Cellar", parent_id: null },
      { id: "box", name: "A2", parent_id: "room" },
    ]).get("box"),
    "Cellar → A2",
  );
  assert.throws(() =>
    inventoryLocationPaths([
      { id: "room", name: "Cellar", parent_id: "box" },
      { id: "box", name: "A2", parent_id: "room" },
    ]),
  );
  const positions = [
    { id: "a", quantity: 4 },
    { id: "b", quantity: 3 },
  ];
  assert.deepEqual(planStorageReduction(8, positions), []);
  assert.deepEqual(planStorageReduction(5, positions), [
    { id: "a", quantity: 2, removed: 2 },
  ]);
  assert.deepEqual(planStorageReduction(0, positions), [
    { id: "a", quantity: 0, removed: 4 },
    { id: "b", quantity: 0, removed: 3 },
  ]);
  assert.equal(
    validateAllocationTotal({ value: 0.3, unit: "kg" }, [0.1, 0.2]),
    0,
  );
  assert.throws(() =>
    validateAllocationTotal({ value: 1, unit: "units" }, [1, 1]),
  );
});
