import assert from "node:assert/strict";
import test from "node:test";
import { calcABV, calcOG } from "@meadtools/core/gravity";
import { calculateGravityTarget } from "../src/calculate-gravity-target";

test("gravity target calculation asks for final gravity instead of assuming one", () => {
  const result = calculateGravityTarget({ targetAbv: 16, additionalOgPoints: 10 });

  assert.equal(result.status, "needs_input");
  if (result.status !== "needs_input") return;
  assert.equal(result.questions[0]?.id, "fermentation_final_gravity");
});

test("gravity target calculation delegates ABV and OG math to shared core", () => {
  const result = calculateGravityTarget({
    targetAbv: 16,
    fermentationFinalGravity: 1.025,
    additionalOgPoints: 10
  });

  assert.equal(result.status, "calculation");
  if (result.status !== "calculation") return;
  assert.ok(Math.abs(result.baseOriginalGravity - calcOG(16, 1.025)) < 1e-12);
  assert.ok(
    Math.abs(
      result.calculatedAbvAtTargetOg - calcABV(result.targetOriginalGravity, 1.025)
    ) < 1e-12
  );
  assert.ok(Math.abs(result.targetOriginalGravity - result.baseOriginalGravity - 0.01) < 1e-12);
});
