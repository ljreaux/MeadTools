import test from "node:test";
import assert from "node:assert/strict";
import { encodeDraftHandoff, decodeDraftHandoff, MAX_DRAFT_TOKEN_LENGTH } from "../src/draft-handoff";
import { buildRecipeDraft } from "../src/build-recipe-draft";
import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";

function fixture() {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" }, targetAbv: 10,
    fermentationFinalGravity: 0.999,
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    allowWaterFill: true,
    nutrients: { enabled: true, yeastBrand: "Lalvin", yeastStrain: "71B", nitrogenRequirement: "Medium", schedule: "tosna", numberOfAdditions: 4, goFermType: "Go-Ferm" },
    stabilizers: { enabled: false },
  });
  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") throw new Error("Invalid fixture");
  return { version: 1 as const, name: "Mélomel 🍯", recipeData: result.recipeData, warnings: result.warnings, assumptions: result.assumptions };
}

test("round trip preserves recipe fields, warnings, Unicode and calculations without changing source", () => {
  const source = fixture();
  source.recipeData.lossAdjustment = { enabled: true, mode: "manual", percentage: 5 };
  source.recipeData.lossAdjustment.secondary = { enabled: true, percentage: 3 };
  source.recipeData.ingredients.push({ ...structuredClone(source.recipeData.ingredients[0]), lineId: "secondary", secondary: true });
  source.recipeData.additives = [{ lineId: "tannin", name: "Tannin", amount: "0.25", unit: "g", amountTouched: true, amountDim: "weight" }];
  source.recipeData.stabilizers = { adding: true, takingPh: true, phReading: "3.5", type: "nameta" };
  source.recipeData.notes.secondary = [{ lineId: "secondary-note", content: ["Wait before bottling", "Keep cool"] }];
  const before = structuredClone(source);
  const restored = decodeDraftHandoff(encodeDraftHandoff(source));
  assert.deepEqual(restored, JSON.parse(JSON.stringify(source)));
  assert.deepEqual(calculateRecipeDerivedApiResponse(restored.recipeData).derived, calculateRecipeDerivedApiResponse(source.recipeData).derived);
  assert.deepEqual(source, before);
});

test("rejects malformed, unsupported and oversized handoffs", () => {
  for (const token of ["", "!!!", "a".repeat(MAX_DRAFT_TOKEN_LENGTH + 1), btoa('{"version":2}')]) {
    assert.throws(() => decodeDraftHandoff(token));
  }
});

test("refuses unknown nested recipe settings instead of dropping them", () => {
  const handoff = JSON.parse(JSON.stringify(fixture()));
  handoff.recipeData.futureSetting = true;
  const token = Buffer.from(JSON.stringify(handoff), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  assert.throws(() => decodeDraftHandoff(token), /Unsupported draft field/);
});
