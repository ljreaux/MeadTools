import assert from "node:assert/strict";
import test from "node:test";

import { BrewEntryIdConflictError } from "@/lib/brews/createBrewEntryIdempotently";
import {
  BrewStageConflictError,
  decideQueuedStageChange
} from "@/lib/brews/queuedStageChange";

const base = { brewId: "brew-1", userId: 7, currentStage: "PRIMARY" };

test("a first delivery in the expected stage is applied", () => {
  assert.equal(decideQueuedStageChange({ ...base, prior: null, expectedStage: "PRIMARY" }), "apply");
  // Callers that do not send an expected stage keep the previous behavior.
  assert.equal(decideQueuedStageChange({ ...base, prior: null }), "apply");
});

test("a retry after a lost response replays instead of moving the brew again", () => {
  // The first delivery already moved the brew to SECONDARY, so the expected
  // stage no longer matches; the existing entry still makes it a replay.
  assert.equal(
    decideQueuedStageChange({
      ...base,
      currentStage: "SECONDARY",
      expectedStage: "PRIMARY",
      prior: { brew_id: "brew-1", user_id: 7, type: "STAGE_CHANGE" }
    }),
    "replay"
  );
});

test("a stale change conflicts and reports the current stage", () => {
  assert.throws(
    () => decideQueuedStageChange({ ...base, currentStage: "BULK_AGE", expectedStage: "PRIMARY", prior: null }),
    (error) => error instanceof BrewStageConflictError && error.currentStage === "BULK_AGE"
  );
});

test("a client UUID used by another entry, brew or owner conflicts", () => {
  for (const prior of [
    { brew_id: "brew-1", user_id: 7, type: "GRAVITY" },
    { brew_id: "brew-2", user_id: 7, type: "STAGE_CHANGE" },
    { brew_id: "brew-1", user_id: 8, type: "STAGE_CHANGE" }
  ]) {
    assert.throws(
      () => decideQueuedStageChange({ ...base, expectedStage: "PRIMARY", prior }),
      BrewEntryIdConflictError
    );
  }
});
