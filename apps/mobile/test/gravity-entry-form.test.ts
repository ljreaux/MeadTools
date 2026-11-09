import assert from "node:assert/strict";
import test from "node:test";

import { entryPayload } from "@meadtools/brew-domain/entry-payload";
import { refractometerCorrectedSg, toBrix, toSG } from "@meadtools/core/gravity";

import {
  buildGravityEnqueueInput,
  canCorrectRefractometer,
  convertGravityText,
  findOriginalGravity,
  parseDecimalInput,
  validateGravityInput,
  type GravityReading
} from "../src/outbox/gravity-entry-form";
import { createOutboxRecord, type EnqueueEntryInput } from "../src/outbox/entry-outbox-record";

const MEASURED_AT = new Date("2026-11-08T07:30:00.000Z");

/** The request body the outbox would send, without the client UUID. */
function sentBody(input: EnqueueEntryInput) {
  const record = createOutboxRecord({
    account: { userId: 1, apiOrigin: "https://meadtools.example" },
    input,
    clientEntryId: "00000000-0000-4000-8000-000000000001",
    now: Date.parse("2026-11-08T08:00:00.000Z")
  });
  const { client_entry_id: _clientEntryId, ...body } = record.request;
  return body;
}

function ok(result: ReturnType<typeof validateGravityInput>): GravityReading {
  assert.equal(result.ok, true);
  return result as GravityReading;
}

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

test("accepts SG as entered and converts uncorrected °Bx with the web formula", () => {
  assert.deepEqual(validateGravityInput("0,995", "SG"), {
    ok: true,
    enteredValue: 0.995,
    unit: "SG",
    sg: 0.995,
    correction: null
  });
  const brix = ok(validateGravityInput("21,5", "BRIX"));
  assert.equal(brix.sg, toSG(21.5));
  assert.equal(brix.correction, null);
});

test("refractometer correction is offered only for °Bx with a recorded OG above 1", () => {
  assert.equal(canCorrectRefractometer("BRIX", 1.1), true);
  assert.equal(canCorrectRefractometer("SG", 1.1), false);
  assert.equal(canCorrectRefractometer("BRIX", null), false);
  assert.equal(canCorrectRefractometer("BRIX", 1), false);
  assert.equal(canCorrectRefractometer("BRIX", Number.NaN), false);

  // Asking for correction without an OG falls back to the uncorrected value.
  const fallback = ok(validateGravityInput("8", "BRIX", { apply: true, factorText: "1", originalGravity: null }));
  assert.equal(fallback.sg, toSG(8));
  assert.equal(fallback.correction, null);
});

test("corrected °Bx uses the web formula and rejects an invalid factor", () => {
  const og = 1.1;
  const corrected = ok(validateGravityInput("8,4", "BRIX", { apply: true, factorText: "1,04", originalGravity: og }));
  assert.equal(corrected.sg, refractometerCorrectedSg(toBrix(og), 8.4, 1.04));
  assert.deepEqual(corrected.correction, { factor: 1.04, originalGravity: og });

  for (const factorText of ["", "0", "-1", "abc"]) {
    assert.deepEqual(
      validateGravityInput("8.4", "BRIX", { apply: true, factorText, originalGravity: og }),
      { ok: false, error: "factor" },
      factorText
    );
  }
});

test("unit switch converts the typed value like the web dialog", () => {
  assert.equal(convertGravityText("1.090", "SG", "BRIX"), toBrix(1.09).toFixed(2));
  assert.equal(convertGravityText("21,50", "BRIX", "SG"), toSG(21.5).toFixed(3));
  assert.equal(convertGravityText("1.090", "SG", "SG"), "1.090");
  assert.equal(convertGravityText("abc", "SG", "BRIX"), "abc");
});

test("an uncorrected reading matches the web request", () => {
  const reading = ok(validateGravityInput("20", "BRIX"));
  const sg = toSG(20);
  const web = entryPayload.gravity(sg, "After punch-down", {
    readingRole: "GENERAL",
    source: "measured",
    datetime: MEASURED_AT.toISOString(),
    display: {
      enteredValue: 20,
      enteredUnit: "BRIX",
      convertedGravity: sg,
      refractometerCorrectionApplied: false,
      correctionFactor: undefined,
      ogUsed: undefined
    }
  });
  assert.deepEqual(
    sentBody(buildGravityEnqueueInput({ brewId: "brew-1", reading, note: "  After punch-down ", measuredAt: MEASURED_AT })),
    JSON.parse(JSON.stringify(web))
  );
});

test("a corrected FG reading matches the web request", () => {
  const og = 1.105;
  const reading = ok(validateGravityInput("7.6", "BRIX", { apply: true, factorText: "1.02", originalGravity: og }));
  const sg = refractometerCorrectedSg(toBrix(og), 7.6, 1.02);
  const web = entryPayload.gravity(sg, null, {
    readingRole: "FG",
    source: "measured",
    datetime: MEASURED_AT.toISOString(),
    display: {
      enteredValue: 7.6,
      enteredUnit: "BRIX",
      convertedGravity: sg,
      refractometerCorrectionApplied: true,
      correctionFactor: 1.02,
      ogUsed: og
    }
  });
  const body = sentBody(buildGravityEnqueueInput({ brewId: "brew-1", reading, role: "FG", note: "", measuredAt: MEASURED_AT }));
  assert.deepEqual(body, JSON.parse(JSON.stringify(web)));
  assert.equal(body.title, "Final gravity");
});

test("an OG reading uses the shared OG title and role", () => {
  const reading = ok(validateGravityInput("1.104", "SG"));
  const body = sentBody(buildGravityEnqueueInput({ brewId: "brew-1", reading, role: "OG", note: "", measuredAt: MEASURED_AT }));
  assert.equal(body.title, "Original gravity");
  assert.equal((body.data as { readingRole: string }).readingRole, "OG");
});

test("the brew's OG is the earliest visible OG-role reading, like the web", () => {
  const gravity = (_label: string, datetime: string, value: number, data: Record<string, unknown>) => ({
    type: "GRAVITY", datetime, gravity: value, data
  });
  assert.equal(
    findOriginalGravity([
      gravity("late", "2026-11-03T00:00:00.000Z", 1.11, { readingRole: "OG" }),
      gravity("hidden", "2026-10-30T00:00:00.000Z", 1.2, { readingRole: "OG", hidden: true }),
      gravity("basis", "2026-10-30T00:00:00.000Z", 1.19, { readingRole: "OG", source: "nutrient_basis" }),
      gravity("general", "2026-10-29T00:00:00.000Z", 1.05, { readingRole: "GENERAL" }),
      gravity("early", "2026-11-01T00:00:00.000Z", 1.1, { readingRole: "OG" }),
      { type: "NOTE", datetime: "2026-10-01T00:00:00.000Z", gravity: null, data: null }
    ]),
    1.1
  );
  assert.equal(findOriginalGravity([]), null);
});

test("an empty note is sent as null", () => {
  const reading = ok(validateGravityInput("1.010", "SG"));
  const input = buildGravityEnqueueInput({ brewId: "brew-1", reading, note: "   ", measuredAt: MEASURED_AT });
  assert.equal((input.payload as { note?: unknown }).note, null);
});
