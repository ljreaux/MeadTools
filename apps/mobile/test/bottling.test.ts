import assert from "node:assert/strict";
import test from "node:test";

import { createBrewEntryRequestBodySchema } from "@meadtools/api-contract";
import { entryPayload } from "@meadtools/brew-domain/entry-payload";
import { bottlingSelectionSchema, inventoryEntryLines } from "@meadtools/inventory-domain";

import {
  buildBottlingSelection, buildPackaging, initialPackagingDraft, packagingStockReview, type PackagingDraft
} from "../src/entries/bottling";
import { createOutboxRecord } from "../src/outbox/entry-outbox-record";
import { ACCOUNT_A, uuidSequence } from "./support/outbox-fakes";

const uuid = uuidSequence();
const rowId = uuid();
const closureId = uuid();
const datetime = "2026-11-09T21:00:00.000Z";
const draft: PackagingDraft = {
  bottles: [{ id: rowId, size: "750ml", custom: "", customUnit: "ml", quantity: "4" }],
  closures: [{ id: closureId, name: "Cork", quantity: "4" }],
  volume: "3,1", unit: "L", note: "  Lot 2  "
};

test("packaging payload uses web bottle IDs, size and measured yield and cannot enter the outbox", () => {
  const payload = buildPackaging(draft, datetime);
  assert.deepEqual(payload, entryPayload.packaging({
    packagedVolumeLiters: 3.1, displayValue: 3.1, displayUnit: "L", datetime, note: "Lot 2",
    bottleRows: [{ id: rowId, label: "750ml", quantity: 4, sizeLiters: 0.75, totalLiters: 3,
      customSizeValue: undefined, customSizeUnits: undefined }],
    closures: [{ id: closureId, name: "Cork", quantity: 4 }]
  }));
  assert.deepEqual(inventoryEntryLines("PACKAGING", payload.data).map((line) => line.key), [
    `bottle:${rowId}`, `closure:${closureId}`
  ]);
  assert.equal(createBrewEntryRequestBodySchema.safeParse({ ...payload, client_entry_id: uuid() }).success, true);
  assert.throws(() => createOutboxRecord({
    account: ACCOUNT_A, clientEntryId: uuid(), now: Date.parse(datetime),
    input: { brewId: "test-brew", payload: { ...payload, datetime } }
  }), /cannot be queued/);
  assert.throws(() => buildPackaging({ ...draft, bottles: [{ ...draft.bottles[0], quantity: "1.5" }] }, datetime));
});

test("legacy rows receive stable new IDs and inventory review keeps the previous expected usage", () => {
  const payload = buildPackaging(draft, datetime);
  const old = { ...payload.data, closures: [{ name: "Cork", quantity: 3 }] };
  const form = initialPackagingDraft(old, "", () => closureId);
  const updated = buildPackaging(form, datetime);
  const id = uuid();
  const cork = {
    id, name: "Cork", category: "packaging", quantity: { value: 10, unit: "units" }
  } as Parameters<typeof packagingStockReview>[1][number];
  const previous = [{
    entry_id: uuid(), line_key: "closure:0", line_name: "Cork", stock_id: id,
    deducted: { value: 3, unit: "units" as const }, stock: cork, stock_archived: false
  }];
  const review = packagingStockReview(updated, [cork], previous, {}, { [`closure:${closureId}`]: "closure:0" });
  const selection = review.selection(uuid());
  assert.equal(selection.mode, "items");
  if (selection.mode !== "items") return;
  assert.deepEqual(selection.expected, [{ line_key: "closure:0", stock_id: id, deducted: { value: 3, unit: "units" } }]);
  assert.deepEqual(selection.items.find((item) => item.stock_id === id), { line_key: `closure:${closureId}`, stock_id: id });
  assert.equal(review.balances()[0].quantity.value, 10);
  assert.equal(packagingStockReview(null, [cork], previous, {}).balances()[0].quantity.value, 13);
});

test("tracked output accepts reviewed splits, rejects over-allocation and requires confirmation to reconcile", () => {
  const payload = buildPackaging(draft, datetime);
  const existing = { kind: "existing" as const, mead_id: uuid() };
  const outputs = [
    { row_id: rowId, quantity: 2, target: existing, location_id: null, position: "" },
    { row_id: rowId, quantity: 1, target: { kind: "new" as const, mead_id: uuid(), name: "Test bottling" }, location_id: null, position: "" }
  ];
  const args = { payload, operationId: uuid(), mode: "sync" as const, confirmed: false, outputs, correcting: false };
  assert.deepEqual(buildBottlingSelection(args), bottlingSelectionSchema.parse({
    operation_id: args.operationId, expected_revision: null, mode: "sync", confirmed_on_hand: false, outputs
  }));
  assert.throws(() => buildBottlingSelection({ ...args, outputs: [{ ...outputs[0], quantity: 5 }] }));
  const source = { entry_id: uuid(), revision: "a".repeat(64), source_name: "Brew", reconciliation_required: true, outputs: [] };
  assert.throws(() => buildBottlingSelection({ ...args, source, mode: "reconcile" }), /on-hand counts/);
  const removal = buildBottlingSelection({
    ...args, payload: null, source, mode: "reconcile", outputs: [], confirmed: true
  });
  assert.equal(removal.expected_revision, source.revision);
  assert.deepEqual(removal.outputs, []);
});
