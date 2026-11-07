import assert from "node:assert/strict";
import test from "node:test";
import { collectionFromSheets, collectionToSheets, inventoryCollectionSchema, type InventoryCollection } from "../src/collection-transfer";

const fixture = (): InventoryCollection => ({
  version: 1,
  consumables: [{ key: "honey", stock: { name: "Honey", category: "honey", quantity: { value: 2.5, unit: "lb" }, notes: "Pantry", catalogReference: null } }],
  meads: [{ key: "pie", name: "Key lime pie", notes: "Summer", bottles: [
    { key: "us", size_liters: 0.355, display_size: { value: 12, unit: "fl_oz" }, quantity: 6 },
    { key: "metric", size_liters: 0.75, display_size: { value: 750, unit: "mL" }, quantity: 4 },
  ] }],
  labels: [{ key: "ready", name: "Ready" }],
  locations: [{ key: "box", name: "Box A", parent_key: "cellar" }, { key: "cellar", name: "Cellar", parent_key: null }],
  assignments: [{ kind: "mead", key: "pie", label_key: "ready" }, { kind: "stock", key: "honey", label_key: "ready" }],
  allocations: [{ stock_key: "us", location_key: "box", position: "A1–A3", quantity: 3 }, { stock_key: "honey", location_key: "cellar", position: "", quantity: 1.5 }],
});
const parse = (data: InventoryCollection) => inventoryCollectionSchema.parse(data);
const sheets = (data: InventoryCollection) => collectionToSheets(data).map(sheet => ({ name: sheet.name, rows: sheet.rows.map(row => row.map(String)) }));

test("collection sheets round trip mixed entered units, notes, split storage and portable keys", () => {
  assert.deepEqual(collectionFromSheets(sheets(fixture())), fixture());
});
test("same-name collections stay separate and zero/legacy bottle rows survive", () => {
  const data = fixture();
  data.meads.push({ key: "another", name: data.meads[0].name, notes: null, bottles: [{ key: "legacy", size_liters: 0.375, quantity: 0 }] });
  assert.deepEqual(collectionFromSheets(sheets(data)), data);
});
test("bottle labels must match capacity; counts and allocations must be whole bottles", () => {
  for (const change of [
    (data: InventoryCollection) => { data.meads[0].bottles[0].display_size = { value: 22, unit: "fl_oz" }; },
    (data: InventoryCollection) => { data.meads[0].bottles[0].quantity = 1.5; },
    (data: InventoryCollection) => { data.allocations[0].quantity = 0.5; },
    (data: InventoryCollection) => { data.allocations[0].quantity = 7; },
    (data: InventoryCollection) => { data.meads[0].bottles[1].size_liters = 0.355; },
  ]) { const data = fixture(); change(data); assert.throws(() => parse(data)); }
});
test("unknown references, duplicate positions and cross-kind label targets fail", () => {
  for (const change of [
    (data: InventoryCollection) => { data.assignments[0].key = "us"; },
    (data: InventoryCollection) => { data.assignments[0].label_key = "missing"; },
    (data: InventoryCollection) => { data.locations[0].parent_key = "missing"; },
    (data: InventoryCollection) => { data.allocations[0].stock_key = "pie"; },
    (data: InventoryCollection) => { data.allocations.push(data.allocations[0]); },
    (data: InventoryCollection) => { data.meads[0].bottles[0].key = "honey"; },
    (data: InventoryCollection) => { data.assignments.push(data.assignments[0]); },
  ]) { const data = fixture(); change(data); assert.throws(() => parse(data)); }
});
test("cycles, normalized duplicate categories and sibling locations fail", () => {
  for (const change of [
    (data: InventoryCollection) => { data.locations[1].parent_key = "box"; },
    (data: InventoryCollection) => { data.labels.push({ key: "duplicate", name: "Ｒｅａｄｙ" }); },
    (data: InventoryCollection) => { data.locations.push({ key: "duplicate", name: "BOX A", parent_key: "cellar" }); },
  ]) { const data = fixture(); change(data); assert.throws(() => parse(data)); }
});
test("edited workbooks reject missing/duplicate sheets, changed headers, inconsistent groups and extra columns", () => {
  for (const change of [
    (rows: ReturnType<typeof sheets>) => { rows.pop(); },
    (rows: ReturnType<typeof sheets>) => { rows.push(rows[0]); },
    (rows: ReturnType<typeof sheets>) => { rows[0].rows[0][0] = "Wrong"; },
    (rows: ReturnType<typeof sheets>) => { rows[1].rows[2][1] = "Different name"; },
    (rows: ReturnType<typeof sheets>) => { rows[0].rows[1].push("lost data"); },
    (rows: ReturnType<typeof sheets>) => { rows[0].rows[1][3] = "2,5"; },
    (rows: ReturnType<typeof sheets>) => { rows[1].rows[1][4] = ""; rows[1].rows[1][5] = ""; rows[1].rows[1][6] = ""; },
  ]) { const rows = sheets(fixture()); change(rows); assert.throws(() => collectionFromSheets(rows)); }
});
test("a hand-entered collection needs only bottle size, unit and count, without doing liter conversions", () => {
  const rows = sheets(fixture());
  rows[1].rows[1][4] = "";
  const result = collectionFromSheets(rows);
  assert.equal(result.meads[0].bottles[0].size_liters, 0.354882);
  assert.deepEqual(result.meads[0].bottles[0].display_size, { value: 12, unit: "fl_oz" });
});
test("bounded collection validation prevents importing stock/organization the editors cannot manage", () => {
  const data = fixture();
  data.allocations = Array.from({ length: 101 }, (_, i) => ({ stock_key: "us", location_key: "box", position: String(i), quantity: 1 }));
  data.meads[0].bottles[0].quantity = 200;
  assert.throws(() => parse(data));
  const tooMany = fixture();
  tooMany.consumables = Array.from({ length: 1000 }, (_, i) => ({ ...tooMany.consumables[0], key: String(i) }));
  assert.throws(() => parse(tooMany));
});
