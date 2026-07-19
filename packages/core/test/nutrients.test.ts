import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateEffectiveNutrientData,
  calculateNutrientDerivedState,
  initialNutrientData
} from "../src/nutrients";

function totalNutrientGrams(
  goFermType: "Go-Ferm" | "none",
  useBoiledBreadYeast: boolean
) {
  const data = initialNutrientData();
  data.inputs.goFermType = goFermType;
  data.inputs.sg = "1.1";
  data.selected.selectedNutrients = {
    fermO: !useBoiledBreadYeast,
    fermK: false,
    dap: false,
    other: useBoiledBreadYeast
  };
  data.selected.schedule = useBoiledBreadYeast ? "other" : "tosna";

  if (useBoiledBreadYeast) {
    data.settings.maxGplTouched = true;
    data.settings.maxGpl.other = "7.5";
    data.settings.yanContribution.other = "13.333333333333334";
    data.settings.other = {
      name: "Boiled Bread Yeast (BBY)",
      usesOrganicMultiplier: true
    };
  }

  const effectiveData = calculateEffectiveNutrientData(data);
  const key = useBoiledBreadYeast ? "other" : "fermO";
  return calculateNutrientDerivedState(effectiveData).nutrientAdditions
    .totalGrams[key];
}

test("organic Other nutrients use the Fermaid O effectiveness multiplier", () => {
  for (const goFermType of ["Go-Ferm", "none"] as const) {
    const fermaidOGrams = totalNutrientGrams(goFermType, false);
    const boiledBreadYeastGrams = totalNutrientGrams(goFermType, true);

    assert.ok(
      Math.abs(boiledBreadYeastGrams - fermaidOGrams * 3) < 1e-10,
      `${goFermType} should keep BBY at three times the Fermaid O dose`
    );
  }
});
