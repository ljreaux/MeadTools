import assert from "node:assert/strict";
import test from "node:test";

import { brewDeleteOutboxState } from "../src/brews/brew-delete";

const record = (clientEntryId: string, status: string) =>
  ({ clientEntryId, delivery: { status } }) as never;

test("unsent outbox entries are listed and an upload in flight blocks deleting", () => {
  assert.deepEqual(brewDeleteOutboxState([]), { sending: false, unsentIds: [] });
  assert.deepEqual(
    brewDeleteOutboxState([
      record("a", "pending"),
      record("b", "synchronized"),
      record("c", "terminal_failure"),
      record("d", "retryable_failure"),
      record("e", "auth_required")
    ]),
    { sending: false, unsentIds: ["a", "c", "d", "e"] }
  );
  assert.equal(brewDeleteOutboxState([record("a", "sending")]).sending, true);
});
