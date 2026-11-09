import assert from "node:assert/strict";
import test from "node:test";

import { MeadToolsApiError } from "@meadtools/api-client";
import { VOLUME_TO_L } from "@meadtools/core/recipe";

import {
  additionEditUnits,
  buildEntryUpdate,
  canDeleteEntry,
  editKind,
  initialEditFields,
  needsStockReview,
  type SavedEntry
} from "../src/entries/entry-edit";
import {
  buildDeductionSelection,
  inventoryErrorCode,
  planAdditionStock,
  previewBalance,
  UNTRACKED,
  type StockItem
} from "../src/entries/inventory-deduction";

function entry(overrides: Partial<SavedEntry>): SavedEntry {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    datetime: "2026-11-08T12:00:00.000Z",
    type: "NOTE",
    title: null,
    note: null,
    gravity: null,
    temperature: null,
    temp_units: null,
    data: null,
    user_id: 7,
    ...overrides
  };
}

function stock(overrides: Partial<StockItem> & Pick<StockItem, "id" | "name" | "category" | "quantity">): StockItem {
  return {
    catalogReference: null,
    notes: null,
    reconciliation_required: false,
    cost: { unit_cost: null, currency: null },
    ...overrides
  } as StockItem;
}

const HONEY = stock({ id: "00000000-0000-4000-8000-0000000000a1", name: "Wildflower honey", category: "honey", quantity: { value: 12, unit: "lb" } });
const DAP = stock({ id: "00000000-0000-4000-8000-0000000000a2", name: "DAP", category: "additive", quantity: { value: 50, unit: "g" } });
const REVIEW = stock({ id: "00000000-0000-4000-8000-0000000000a3", name: "Clover honey", category: "honey", quantity: { value: 5, unit: "lb" }, reconciliation_required: true });

// --- Editing saved entries -------------------------------------------------

test("a note-only edit never sends data, so inventory-linked entries can be annotated", () => {
  const addition = entry({
    type: "ADDITION",
    title: "Wildflower honey",
    data: { kind: "INGREDIENT", name: "Wildflower honey", amount: 2, unit: "lb" }
  });
  const initial = initialEditFields(addition);
  const result = buildEntryUpdate(addition, initial, { ...initial, note: "Added after racking" });
  assert.deepEqual(result, { ok: true, body: { note: "Added after racking" }, changed: true });

  const unchanged = buildEntryUpdate(addition, initial, initial);
  assert.deepEqual(unchanged, { ok: true, body: {}, changed: false });
});

test("editing a gravity value updates the reading and its display metadata", () => {
  const gravity = entry({
    type: "GRAVITY",
    gravity: 1.0423,
    data: { readingRole: "FG", source: "measured", display: { enteredValue: 10.5, enteredUnit: "BRIX" } }
  });
  assert.equal(editKind(gravity), "gravity");
  const initial = initialEditFields(gravity);
  assert.equal(initial.valueText, "1.042");
  const result = buildEntryUpdate(gravity, initial, { ...initial, valueText: "1,010" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.body.gravity, 1.01);
  assert.deepEqual(result.body.data, {
    readingRole: "FG",
    source: "measured",
    display: { enteredValue: 1.01, enteredUnit: "SG", convertedGravity: 1.01, refractometerCorrectionApplied: false }
  });

  assert.deepEqual(buildEntryUpdate(gravity, initial, { ...initial, valueText: "1050" }), {
    ok: false, field: "value", error: "range"
  });
});

test("temperature, pH and volume edits send only their own fields", () => {
  const temperature = entry({ type: "TEMPERATURE", temperature: 68, temp_units: "F" });
  const tInitial = initialEditFields(temperature);
  assert.deepEqual(buildEntryUpdate(temperature, tInitial, { ...tInitial, valueText: "19,5", unit: "C" }), {
    ok: true, body: { temperature: 19.5, temp_units: "C" }, changed: true
  });

  const ph = entry({ type: "PH", data: { ph: 3.4 } });
  const pInitial = initialEditFields(ph);
  assert.deepEqual(buildEntryUpdate(ph, pInitial, { ...pInitial, valueText: "3.6" }).ok && buildEntryUpdate(ph, pInitial, { ...pInitial, valueText: "3.6" }), {
    ok: true, body: { data: { ph: 3.6 } }, changed: true
  });

  const volume = entry({ type: "VOLUME", data: { liters: 18.9, displayValue: 5, displayUnit: "gal" } });
  const vInitial = initialEditFields(volume);
  assert.deepEqual(vInitial.valueText, "5");
  assert.equal(vInitial.unit, "gal");
  const vResult = buildEntryUpdate(volume, vInitial, { ...vInitial, valueText: "4.5" });
  assert.equal(vResult.ok, true);
  if (!vResult.ok) return;
  assert.deepEqual(vResult.body.data, { liters: 4.5 * VOLUME_TO_L.gal, displayValue: 4.5, displayUnit: "gal" });
});

test("addition edits keep metadata, update the title with the name, and allow removing the amount", () => {
  const addition = entry({
    type: "ADDITION",
    title: "Honey",
    data: { kind: "INGREDIENT", source: "manual", name: "Honey", amount: 2, unit: "lbs", meta: { plannedName: "Honey" } }
  });
  const initial = initialEditFields(addition);
  assert.deepEqual(additionEditUnits(initial.unit).slice(0, 2), ["lbs", "g"]);
  const renamed = buildEntryUpdate(addition, initial, { ...initial, name: "Orange blossom honey", valueText: "2.5", unit: "lb" });
  assert.deepEqual(renamed, {
    ok: true,
    body: {
      title: "Orange blossom honey",
      data: { kind: "INGREDIENT", source: "manual", name: "Orange blossom honey", amount: 2.5, unit: "lb", meta: { plannedName: "Honey" } }
    },
    changed: true
  });
  const noAmount = buildEntryUpdate(addition, initial, { ...initial, valueText: "" });
  assert.equal(noAmount.ok && "amount" in (noAmount.body.data as object), false);
  assert.deepEqual(buildEntryUpdate(addition, initial, { ...initial, name: " " }), { ok: false, field: "name", error: "empty" });
});

test("notes keep required text, and stage changes edit their note only and cannot be deleted", () => {
  const note = entry({ type: "NOTE", title: "Smell", note: "Fruity" });
  const nInitial = initialEditFields(note);
  assert.deepEqual(buildEntryUpdate(note, nInitial, { ...nInitial, title: "" }), { ok: true, body: { title: null }, changed: true });
  assert.deepEqual(buildEntryUpdate(note, nInitial, { ...nInitial, note: "  " }), { ok: false, field: "note", error: "empty" });

  const stage = entry({ type: "STAGE_CHANGE", data: { from: "PRIMARY", to: "SECONDARY" } });
  assert.equal(editKind(stage), "noteOnly");
  assert.equal(canDeleteEntry(stage), false);
  assert.equal(canDeleteEntry(note), true);
  const sInitial = initialEditFields(stage);
  assert.deepEqual(buildEntryUpdate(stage, sInitial, { ...sInitial, note: "Racked" }).ok, true);

  // Packaging (bottling) and abv estimates are note-only on Mobile.
  assert.equal(editKind(entry({ type: "PACKAGING", data: { packagedVolumeLiters: 18 } })), "noteOnly");
  assert.equal(editKind(entry({ type: "GRAVITY", gravity: 12, data: { source: "abv_estimate" } })), "noteOnly");
});

// --- Deducting a new addition from stock ------------------------------------

test("a new addition matches compatible stock like the web, excluding stock needing review", () => {
  const plan = planAdditionStock([HONEY, DAP, REVIEW], {
    kind: "INGREDIENT", name: "Wildflower honey", amount: 2, unit: "lb"
  });
  assert.ok(plan.line);
  assert.equal(plan.line?.key, "addition");
  assert.deepEqual(plan.choices.map((item) => item.name), ["Wildflower honey"]);
  assert.equal(plan.defaultChoice, HONEY.id);

  // Without an amount there is nothing to deduct.
  assert.deepEqual(planAdditionStock([HONEY], { kind: "INGREDIENT", name: "Honey" }), {
    line: null, choices: [], defaultChoice: UNTRACKED
  });
  // Nutrients only match additive stock.
  const nutrient = planAdditionStock([HONEY, DAP], { kind: "NUTRIENT", name: "DAP", amount: 2, unit: "g" });
  assert.deepEqual(nutrient.choices.map((item) => item.id), [DAP.id]);
});

test("the balance preview converts units and reports shortages", () => {
  const plan = planAdditionStock([HONEY], { kind: "INGREDIENT", name: "Wildflower honey", amount: 32, unit: "oz" });
  assert.ok(plan.line);
  if (!plan.line) return;
  const preview = previewBalance([HONEY], plan.line, HONEY.id);
  assert.deepEqual(preview, { ok: true, balance: { value: 10, unit: "lb" } });

  const tooMuch = planAdditionStock([HONEY], { kind: "INGREDIENT", name: "Wildflower honey", amount: 20, unit: "lb" });
  assert.ok(tooMuch.line);
  if (!tooMuch.line) return;
  assert.deepEqual(previewBalance([HONEY], tooMuch.line, HONEY.id), {
    ok: false, code: "INSUFFICIENT_STOCK", shortage: 8, unit: "lb"
  });
});

test("the deduction uses the web's items selection and surfaces server codes", () => {
  const plan = planAdditionStock([HONEY], { kind: "INGREDIENT", name: "Wildflower honey", amount: 1, unit: "lb" });
  assert.ok(plan.line);
  if (!plan.line) return;
  assert.deepEqual(buildDeductionSelection(plan.line, HONEY.id, "00000000-0000-4000-8000-0000000000ff"), {
    mode: "items",
    operation_id: "00000000-0000-4000-8000-0000000000ff",
    items: [{ line_key: "addition", stock_id: HONEY.id }],
    expected: []
  });
  assert.equal(
    inventoryErrorCode(new MeadToolsApiError(409, { error: "Insufficient stock", code: "INSUFFICIENT_STOCK" })),
    "INSUFFICIENT_STOCK"
  );
  assert.equal(inventoryErrorCode(new MeadToolsApiError(500, null)), null);
  assert.equal(inventoryErrorCode(new TypeError("offline")), null);
});

test("only a reconciliation outcome asks the user to review stock after an edit or delete", () => {
  assert.equal(needsStockReview({ status: "reconciliation_required" }), true);
  for (const status of ["untracked", "deducted", "premium_unavailable"]) {
    assert.equal(needsStockReview({ status }), false);
  }
  assert.equal(needsStockReview(undefined), false);
  assert.equal(needsStockReview(null), false);
});
