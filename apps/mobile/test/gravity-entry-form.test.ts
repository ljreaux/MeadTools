import assert from "node:assert/strict";
import test from "node:test";

import { entryPayload } from "@meadtools/brew-domain/entry-payload";
import { toBrix, toSG } from "@meadtools/core/gravity";

import {
  buildGravityEnqueueInput,
  convertGravityText,
  parseDecimalInput,
  validateGravityInput
} from "../src/outbox/gravity-entry-form";
import { createGravityOutboxRecord } from "../src/outbox/gravity-outbox-record";

test("parses English and German decimal entry", () => {
  assert.equal(parseDecimalInput("1.050"), 1.05);
  assert.equal(parseDecimalInput("1,050"), 1.05);
  assert.equal(parseDecimalInput(" 12,5 "), 12.5);
  assert.equal(parseDecimalInput(".998"), 0.998);
  assert.equal(parseDecimalInput("-1.5"), -1.5);
  assert.equal(parseDecimalInput("−1,5"), -1.5);
  assert.equal(parseDecimalInput("1."), 1);
});

test("rejects text that is not a single decimal number", () => {
  for (const text of ["", "  ", "abc", "1.0.5", "1,0,5", "1.050,2", "1e3", "Infinity", "NaN", "1 050x", "--1"]) {
    assert.equal(parseDecimalInput(text), null, text);
  }
});

test("refuses empty, invalid and implausible readings", () => {
  assert.deepEqual(validateGravityInput("", "SG"), { ok: false, error: "empty" });
  assert.deepEqual(validateGravityInput("1.0.5", "SG"), { ok: false, error: "invalid" });
  assert.deepEqual(validateGravityInput("1050", "SG"), { ok: false, error: "range" });
  assert.deepEqual(validateGravityInput("0.5", "SG"), { ok: false, error: "range" });
  assert.deepEqual(validateGravityInput("75", "BRIX"), { ok: false, error: "range" });
  assert.deepEqual(validateGravityInput("-6", "BRIX"), { ok: false, error: "range" });
});

test("accepts SG as entered and converts °Bx with the uncorrected web formula", () => {
  assert.deepEqual(validateGravityInput("0,995", "SG"), {
    ok: true,
    enteredValue: 0.995,
    unit: "SG",
    sg: 0.995
  });

  const brix = validateGravityInput("21,5", "BRIX");
  assert.equal(brix.ok, true);
  if (!brix.ok) return;
  assert.equal(brix.enteredValue, 21.5);
  assert.equal(brix.sg, toSG(21.5));
  assert.ok(brix.sg > 1.08 && brix.sg < 1.1);
});

test("unit switch converts the typed value like the web dialog", () => {
  assert.equal(convertGravityText("1.090", "SG", "BRIX"), toBrix(1.09).toFixed(2));
  assert.equal(convertGravityText("21,50", "BRIX", "SG"), toSG(21.5).toFixed(3));
  assert.equal(convertGravityText("1.090", "SG", "SG"), "1.090");
  assert.equal(convertGravityText("abc", "SG", "BRIX"), "abc");
});

test("builds the same request the web app sends for an uncorrected reading", () => {
  const reading = validateGravityInput("20", "BRIX");
  assert.equal(reading.ok, true);
  if (!reading.ok) return;
  const measuredAt = new Date("2026-11-08T07:30:00.000Z");
  const input = buildGravityEnqueueInput({
    brewId: "brew-1",
    reading,
    note: "  After punch-down ",
    measuredAt
  });

  // The web dialog's equivalent payload (AddBrewEntryDialog, °Bx, no correction).
  const sg = toSG(20);
  const web = entryPayload.gravity(sg, "After punch-down", {
    readingRole: "GENERAL",
    source: "measured",
    datetime: measuredAt.toISOString(),
    display: {
      enteredValue: 20,
      enteredUnit: "BRIX",
      convertedGravity: sg,
      refractometerCorrectionApplied: false,
      correctionFactor: undefined,
      ogUsed: undefined
    }
  });

  const record = createGravityOutboxRecord({
    account: { userId: 1, apiOrigin: "https://meadtools.example" },
    input,
    clientEntryId: "00000000-0000-4000-8000-000000000001",
    now: Date.parse("2026-11-08T08:00:00.000Z")
  });
  const { client_entry_id: _clientEntryId, ...sent } = record.request;
  assert.deepEqual(sent, JSON.parse(JSON.stringify(web)));
  assert.equal(record.measuredAt, "2026-11-08T07:30:00.000Z");
});

test("an empty note is sent as null", () => {
  const reading = validateGravityInput("1.010", "SG");
  assert.equal(reading.ok, true);
  if (!reading.ok) return;
  const input = buildGravityEnqueueInput({
    brewId: "brew-1",
    reading,
    note: "   ",
    measuredAt: new Date()
  });
  assert.equal(input.note, null);
});
