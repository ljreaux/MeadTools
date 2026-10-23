import test from "node:test";
import assert from "node:assert/strict";
import { buildRecipeDraft } from "@meadtools/recipe-workflows";
import { encodeDraftHandoff } from "@meadtools/recipe-workflows/draft-handoff";
import { openDraftHandoff } from "./draft-handoff";

test("sign-in return preserves edited draft and leaves home/source recipes alone", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetAbv: 10,
    fermentationFinalGravity: 0.999,
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    allowWaterFill: true,
    nutrients: {
      enabled: true,
      yeastBrand: "Lalvin",
      yeastStrain: "71B",
      nitrogenRequirement: "Medium",
      schedule: "tosna",
      numberOfAdditions: 4,
      goFermType: "Go-Ferm"
    },
    stabilizers: { enabled: false }
  });
  if (result.status !== "recipe") throw new Error("Invalid fixture");
  const token = encodeDraftHandoff({
    version: 1,
    name: "Test",
    recipeData: result.recipeData,
    warnings: result.warnings,
    assumptions: result.assumptions
  });
  const values = new Map([
    ["meadtools:recipe::draft", "home draft"],
    ["saved-recipe:42", "original"]
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    }
  };
  const id = "00000000-0000-4000-8000-000000000000";
  const opened = openDraftHandoff(
    `https://meadtools.com/recipe-draft#${token}`,
    storage,
    () => id
  );
  assert.ok(!opened.returnPath.includes(token));
  const edited = { ...result.recipeData, fg: "1.005" };
  storage.setItem(opened.key, JSON.stringify(edited));
  const returned = openDraftHandoff(
    `https://meadtools.com${opened.returnPath}`,
    storage,
    () => {
      throw new Error("Should reuse draft");
    }
  );
  assert.equal(returned.key, opened.key);
  assert.equal(JSON.parse(storage.getItem(returned.key)!).fg, "1.005");
  assert.equal(storage.getItem("meadtools:recipe::draft"), "home draft");
  assert.equal(storage.getItem("saved-recipe:42"), "original");
});
