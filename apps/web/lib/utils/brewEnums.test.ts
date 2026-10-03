import assert from "node:assert/strict";
import test from "node:test";

import {
  brewEntryTypeResponseSchema,
  brewStageResponseSchema
} from "@meadtools/api-contract/brews";

import {
  BREW_ENTRY_TYPE,
  BREW_STAGE,
  getBrewTrackerStage
} from "../brewEnums";

test("web brew enums stay aligned with the API contract", () => {
  assert.deepEqual(
    Object.values(BREW_STAGE).sort(),
    [...brewStageResponseSchema.options].sort()
  );
  assert.deepEqual(
    Object.values(BREW_ENTRY_TYPE).sort(),
    [...brewEntryTypeResponseSchema.options].sort()
  );
});

test("the six-panel web tracker keeps later aging states in bulk aging", () => {
  assert.equal(getBrewTrackerStage("STABILIZED"), "BULK_AGE");
  assert.equal(getBrewTrackerStage("BACKSWEETENED"), "BULK_AGE");
  assert.equal(getBrewTrackerStage("PRIMARY"), "PRIMARY");
  assert.equal(getBrewTrackerStage("PACKAGED"), "PACKAGED");
});
