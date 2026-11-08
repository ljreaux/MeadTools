import assert from "node:assert/strict";
import test from "node:test";

import { entryPayload } from "@meadtools/brew-domain/entry-payload";
import { VOLUME_TO_L } from "@meadtools/core/recipe";

import {
  buildAdditionInput,
  buildPhInput,
  buildTemperatureInput,
  buildTextEntryInput,
  buildVolumeInput,
  parseNumberField,
  PH_RANGE,
  preferredVolumeUnit,
  TEMPERATURE_RANGES,
  validateAddition
} from "../src/outbox/entry-forms";
import {
  createOutboxRecord,
  OutboxValidationError,
  type EnqueueEntryInput
} from "../src/outbox/entry-outbox-record";
import { projectQueuedEntry } from "../src/outbox/timeline-delivery";

const MEASURED_AT = new Date("2026-11-08T07:30:00.000Z");
const ISO = MEASURED_AT.toISOString();
const ACCOUNT = { userId: 1, apiOrigin: "https://meadtools.example" };
const UUID = "00000000-0000-4000-8000-000000000001";

function record(input: EnqueueEntryInput) {
  return createOutboxRecord({ account: ACCOUNT, input, clientEntryId: UUID, now: Date.parse("2026-11-08T08:00:00.000Z") });
}

function sentBody(input: EnqueueEntryInput) {
  const { client_entry_id: _clientEntryId, ...body } = record(input).request;
  return body;
}

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

test("number fields refuse empty, invalid and out-of-range values", () => {
  assert.deepEqual(parseNumberField(""), { ok: false, error: "empty" });
  assert.deepEqual(parseNumberField("abc"), { ok: false, error: "invalid" });
  assert.deepEqual(parseNumberField("15", PH_RANGE), { ok: false, error: "range" });
  assert.deepEqual(parseNumberField("3,4", PH_RANGE), { ok: true, value: 3.4 });
  assert.deepEqual(parseNumberField("300", TEMPERATURE_RANGES.F), { ok: false, error: "range" });
  assert.deepEqual(parseNumberField("0", { min: 0, max: 10, exclusiveMin: true }), { ok: false, error: "range" });
});

test("temperature matches the web dialog request", () => {
  assert.deepEqual(
    sentBody(buildTemperatureInput({ brewId: "b", value: 68.5, unit: "F", note: " Cellar ", measuredAt: MEASURED_AT })),
    json(entryPayload.temperature(68.5, "F", "Cellar", ISO))
  );
});

test("pH matches the web dialog request", () => {
  assert.deepEqual(
    sentBody(buildPhInput({ brewId: "b", value: 3.4, note: "", measuredAt: MEASURED_AT })),
    json(entryPayload.ph(3.4, null, ISO))
  );
});

test("volume converts to liters and keeps the entered value and unit like the web", () => {
  const body = sentBody(buildVolumeInput({ brewId: "b", value: 5.2, unit: "gal", note: "", measuredAt: MEASURED_AT }));
  assert.deepEqual(
    body,
    json(entryPayload.volume({
      liters: 5.2 * VOLUME_TO_L.gal,
      displayValue: 5.2,
      displayUnit: "gal",
      note: null,
      datetime: ISO
    }))
  );
  assert.equal(preferredVolumeUnit("us"), "gal");
  assert.equal(preferredVolumeUnit("uk"), "imp_gal");
  assert.equal(preferredVolumeUnit("metric"), "L");
  assert.equal(preferredVolumeUnit(null), "L");
});

test("notes, tastings and issues match the web dialog requests", () => {
  assert.deepEqual(
    sentBody(buildTextEntryInput({ brewId: "b", type: "NOTE", title: " Smell ", note: " Fruity ", measuredAt: MEASURED_AT })),
    json(entryPayload.note("Fruity", "Smell", null, ISO))
  );
  assert.deepEqual(
    sentBody(buildTextEntryInput({ brewId: "b", type: "NOTE", title: "", note: "Fruity", measuredAt: MEASURED_AT })),
    json(entryPayload.note("Fruity", null, null, ISO))
  );
  assert.deepEqual(
    sentBody(buildTextEntryInput({ brewId: "b", type: "TASTING", title: "ignored", note: "Dry", measuredAt: MEASURED_AT })),
    json(entryPayload.tasting("Dry", "Tasting", ISO))
  );
  assert.deepEqual(
    sentBody(buildTextEntryInput({ brewId: "b", type: "ISSUE", title: "", note: "Off smell", measuredAt: MEASURED_AT })),
    json(entryPayload.issue("Off smell", "Issue", ISO))
  );
});

test("an empty note, tasting or issue cannot be queued", () => {
  assert.throws(
    () => record(buildTextEntryInput({ brewId: "b", type: "NOTE", title: "Title only", note: "  ", measuredAt: MEASURED_AT })),
    OutboxValidationError
  );
});

test("addition validation requires a name and a positive amount when given", () => {
  const base = { name: " Honey ", kind: "INGREDIENT" as const, amountText: "", unit: "lb" as const };
  assert.deepEqual(validateAddition(base), { ok: true, name: "Honey", amount: undefined });
  assert.deepEqual(validateAddition({ ...base, amountText: "1,5" }), { ok: true, name: "Honey", amount: 1.5 });
  assert.deepEqual(validateAddition({ ...base, name: " " }), { ok: false, field: "name", error: "empty" });
  assert.deepEqual(validateAddition({ ...base, amountText: "0" }), { ok: false, field: "amount", error: "range" });
  assert.deepEqual(validateAddition({ ...base, amountText: "x" }), { ok: false, field: "amount", error: "invalid" });
});

test("a manual addition matches the web's buildAddition shape", () => {
  const body = sentBody(buildAdditionInput({
    brewId: "b",
    name: "Wildflower honey",
    kind: "INGREDIENT",
    amount: 1.1234567,
    unit: "lb",
    note: "Backsweetening",
    stage: "SECONDARY",
    measuredAt: MEASURED_AT
  }));
  assert.deepEqual(body, json(entryPayload.addition({
    name: "Wildflower honey",
    kind: "INGREDIENT",
    source: "manual",
    amount: 1.123457,
    unit: "lb",
    note: "Backsweetening",
    meta: { plannedName: "Wildflower honey", stage: "SECONDARY" },
    datetime: ISO
  })));

  const noAmount = sentBody(buildAdditionInput({
    brewId: "b", name: "Oak cubes", kind: "OTHER", amount: undefined, unit: "g", note: "", stage: null, measuredAt: MEASURED_AT
  }));
  assert.deepEqual((noAmount.data as Record<string, unknown>).meta, { plannedName: "Oak cubes" });
  assert.equal((noAmount.data as Record<string, unknown>).unit, undefined);
});

test("stage changes, inventory deductions and bottling are never queued", () => {
  const stageChange = { brewId: "b", payload: { type: "STAGE_CHANGE", datetime: ISO } } as unknown as EnqueueEntryInput;
  assert.throws(() => record(stageChange), OutboxValidationError);

  const addition = buildAdditionInput({
    brewId: "b", name: "Honey", kind: "INGREDIENT", amount: 1, unit: "lb", note: "", stage: null, measuredAt: MEASURED_AT
  });
  const withInventory = {
    ...addition,
    payload: { ...addition.payload, inventory: { mode: "untracked" } }
  } as unknown as EnqueueEntryInput;
  assert.throws(() => record(withInventory), OutboxValidationError);
});

test("queued entries project into the same timeline rows as server entries", () => {
  const temperature = projectQueuedEntry(
    record(buildTemperatureInput({ brewId: "b", value: 20, unit: "C", note: "", measuredAt: MEASURED_AT })),
    "PRIMARY"
  );
  assert.deepEqual(temperature.detail, { kind: "temperature", value: 20, unit: "C" });
  assert.equal(temperature.stage, "PRIMARY");

  const volume = projectQueuedEntry(
    record(buildVolumeInput({ brewId: "b", value: 19, unit: "L", note: "", measuredAt: MEASURED_AT })),
    null
  );
  assert.deepEqual(volume.detail, { kind: "volume", value: 19, unit: "L", packages: null });

  const addition = projectQueuedEntry(
    record(buildAdditionInput({ brewId: "b", name: "DAP", kind: "NUTRIENT", amount: 2, unit: "g", note: "", stage: "PRIMARY", measuredAt: MEASURED_AT })),
    "PRIMARY"
  );
  assert.deepEqual(addition.detail, { kind: "addition", name: "DAP", amount: 2, unit: "g" });

  const note = projectQueuedEntry(
    record(buildTextEntryInput({ brewId: "b", type: "TASTING", title: "", note: "Dry", measuredAt: MEASURED_AT })),
    null
  );
  assert.equal(note.type, "TASTING");
  assert.equal(note.note, "Dry");
  assert.equal(note.id, UUID);
  assert.equal(note.datetime, ISO);
});
