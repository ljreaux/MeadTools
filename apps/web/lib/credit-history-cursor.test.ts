import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeCreditActivityCursor,
  encodeCreditActivityCursor,
  InvalidCreditActivityCursorError,
} from "./credit-history-cursor";

test("credit history paginates existing hash-derived grant IDs without changing them", () => {
  for (const operationId of [
    "01234567-89ab-cdef-0123-456789abcdef",
    "b9523da9-7c2c-4a5f-a55a-b7451ef20d1f",
  ]) {
    const cursor = { occurredAt: new Date("2026-10-12T12:00:00.000Z"), operationId };
    assert.deepEqual(decodeCreditActivityCursor(encodeCreditActivityCursor(cursor)), cursor);
  }
});

test("credit history rejects malformed cursor IDs and dates", () => {
  for (const cursor of [
    { occurredAt: "2026-10-12T12:00:00.000Z", operationId: "not-a-uuid" },
    { occurredAt: "2026-10-12T12:00:00.000Z", operationId: "'; DROP TABLE users;--" },
    { occurredAt: "invalid", operationId: "01234567-89ab-cdef-0123-456789abcdef" },
    { occurredAt: "2026-10-12T12:00:00.000Z", operationId: null },
    null,
  ]) {
    const encoded = Buffer.from(JSON.stringify(cursor)).toString("base64url");
    assert.throws(() => decodeCreditActivityCursor(encoded), InvalidCreditActivityCursorError);
  }
  assert.throws(() => decodeCreditActivityCursor("not-json"), InvalidCreditActivityCursorError);
});
