import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateNoteGate } from "./check-pr-release-notes.mjs";

const entry = {
  title: "October 2026",
  summary: "Verified changes",
  products: { web: { items: ["A shipped improvement"] } },
};

test("accepts a new dated product note", () => {
  assert.equal(evaluateNoteGate({ baseEntries: {}, headEntries: { "2026-10-04": entry }, labels: [], body: "" }).ok, true);
});

test("rejects an unchanged note and a malformed entry", () => {
  assert.equal(evaluateNoteGate({ baseEntries: { "2026-10-04": entry }, headEntries: { "2026-10-04": entry }, labels: [], body: "" }).ok, false);
  assert.equal(evaluateNoteGate({ baseEntries: {}, headEntries: { "2026-10-04": { ...entry, products: {} } }, labels: [], body: "" }).ok, false);
});

test("requires a labeled, explained bug-only exemption", () => {
  const args = { baseEntries: {}, headEntries: {}, body: "Bug-fix rationale: Fixes a crash when loading saved recipes." };
  assert.equal(evaluateNoteGate({ ...args, labels: [] }).ok, false);
  assert.equal(evaluateNoteGate({ ...args, labels: ["bug-fix-only"] }).ok, true);
  assert.equal(evaluateNoteGate({ ...args, labels: ["bug-fix-only"], body: "Bug-fix rationale: fix" }).ok, false);
});
