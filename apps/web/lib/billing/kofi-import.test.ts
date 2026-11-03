import assert from "node:assert/strict";
import test from "node:test";
import { buildKofiImportPlan } from "./kofi-import";
import { sameImportedKofiPayment } from "./kofi-import-identity";

const members = "Name,Email,IsActive,SinceDateUTC\nLegacy,legacy@example.invalid,True,2026-01-01 00:00\n";
const header = "DateTime (UTC),BuyerEmail,Received,Currency,TransactionType,TransactionId,Given\n";
const id = "12345678-1234-1234-1234-123456789012";
test("historical recurring proof and recent one-time access remain separate", () => {
  const plan = buildKofiImportPlan(members, header +
    `10/15/2026 12:00,legacy@example.invalid,1.00,USD,Monthly Tip,${id},0.00\n` +
    "10/16/2026 12:00,tipper@example.invalid,3.00,USD,Tip,22345678-1234-1234-1234-123456789012,0.00\n" +
    "07/01/2026 12:00,old@example.invalid,3.00,USD,Tip,32345678-1234-1234-1234-123456789012,0.00\n" +
    "10/16/2026 12:00,outgoing@example.invalid,0.00,USD,Tip,42345678-1234-1234-1234-123456789012,5.00\n",
    new Date("2026-11-02T12:00:00Z"));
  assert.equal(plan.recurring.length, 1);
  assert.equal(plan.recurring[0].amountCents, 100);
  assert.deepEqual(plan.promotionalEmails, ["tipper@example.invalid"]);
});
test("bad dates, future payments, and duplicates cannot be silently imported", () => {
  const row = `10/15/2026 12:00,legacy@example.invalid,1.00,USD,Monthly Tip,${id},0.00\n`;
  assert.throws(() => buildKofiImportPlan(members, header + row + row), /Duplicate/);
  assert.throws(() => buildKofiImportPlan(members, header + row.replace("10/15", "02/31")), /timestamp/);
  assert.throws(() => buildKofiImportPlan(members, header + row, new Date("2026-01-01")), /future/);
});

test("a CSV/webhook duplicate needs the same payer, amount, currency, transaction and minute", () => {
  const stored = { message_id: `kofi-csv:${id}`, transaction_id: id, email_digest: "digest", amount_cents: 300, currency: "usd", paid_at: new Date("2026-10-15T12:00:00Z") };
  const incoming = { messageId: "webhook-message", transactionId: id, amountCents: 300, currency: "usd", paidAt: new Date("2026-10-15T12:00:38Z") };
  assert.equal(sameImportedKofiPayment(stored, incoming, "digest"), true);
  assert.equal(sameImportedKofiPayment(stored, incoming, "other-payer"), false);
  assert.equal(sameImportedKofiPayment(stored, { ...incoming, amountCents: 500 }, "digest"), false);
  assert.equal(sameImportedKofiPayment(stored, { ...incoming, currency: "eur" }, "digest"), false);
  assert.equal(sameImportedKofiPayment(stored, { ...incoming, transactionId: "other" }, "digest"), false);
  assert.equal(sameImportedKofiPayment(stored, { ...incoming, paidAt: new Date("2026-10-15T12:01:00Z") }, "digest"), false);
  assert.equal(sameImportedKofiPayment({ ...stored, message_id: "ordinary-webhook" }, incoming, "digest"), false);
});
