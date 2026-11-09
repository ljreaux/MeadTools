import assert from "node:assert/strict";
import test from "node:test";

import { STAGE_FLOW, stageMoveDecision, trackerStage, type StageContext } from "../src/stage-flow";

const none: StageContext = {
  hasRecipeLinked: false,
  hasOriginalGravity: false,
  hasPackagingEntry: false,
  hasPackagedVolume: false
};
const all: StageContext = {
  hasRecipeLinked: true,
  hasOriginalGravity: true,
  hasPackagingEntry: true,
  hasPackagedVolume: true
};

test("stabilized and backsweetened brews are tracked as bulk aging", () => {
  assert.equal(trackerStage("STABILIZED"), "BULK_AGE");
  assert.equal(trackerStage("BACKSWEETENED"), "BULK_AGE");
  assert.equal(trackerStage("PRIMARY"), "PRIMARY");
  assert.deepEqual(STAGE_FLOW, ["PLANNED", "PRIMARY", "SECONDARY", "BULK_AGE", "PACKAGED", "COMPLETE"]);
});

test("the current stage is a no-op", () => {
  assert.deepEqual(stageMoveDecision("PRIMARY", "PRIMARY", all), {
    allowed: false, isNoOp: true, direction: "none", unmet: []
  });
  assert.equal(stageMoveDecision("BULK_AGE", "STABILIZED", all).isNoOp, true);
});

test("moving backward is always allowed", () => {
  assert.deepEqual(stageMoveDecision("PRIMARY", "BULK_AGE", none), {
    allowed: true, isNoOp: false, direction: "backward", unmet: []
  });
});

test("primary needs a linked recipe", () => {
  assert.deepEqual(stageMoveDecision("PRIMARY", "PLANNED", none).unmet, ["linkRecipe"]);
  assert.equal(stageMoveDecision("PRIMARY", "PLANNED", { ...none, hasRecipeLinked: true }).allowed, true);
});

test("crossing into secondary or later needs a recorded OG, like the web tracker", () => {
  assert.deepEqual(stageMoveDecision("SECONDARY", "PRIMARY", none).unmet, ["originalGravity"]);
  // Jumping past secondary uses secondary's prerequisites, not the destination's.
  assert.deepEqual(stageMoveDecision("COMPLETE", "PRIMARY", none).unmet, ["originalGravity"]);
  assert.equal(stageMoveDecision("COMPLETE", "PRIMARY", { ...none, hasOriginalGravity: true }).allowed, true);
  assert.deepEqual(stageMoveDecision("COMPLETE", "PLANNED", none).unmet, ["originalGravity"]);
});

test("completing from secondary or later needs packaging and a packaged volume", () => {
  assert.deepEqual(stageMoveDecision("COMPLETE", "PACKAGED", none).unmet, ["packagingRecorded", "packagedVolume"]);
  assert.deepEqual(
    stageMoveDecision("COMPLETE", "BULK_AGE", { ...none, hasPackagingEntry: true }).unmet,
    ["packagedVolume"]
  );
  assert.equal(stageMoveDecision("PACKAGED", "BULK_AGE", none).allowed, true);
  assert.equal(stageMoveDecision("BULK_AGE", "SECONDARY", none).allowed, true);
});
