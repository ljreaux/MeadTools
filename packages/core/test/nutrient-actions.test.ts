import assert from "node:assert/strict";
import test from "node:test";
import { toBrix } from "../src/gravity";
import { parseNumber } from "../src/numeric";
import {
  applyNutrientAction,
  getEffectiveMaxGpl,
  initialNutrientData,
  scheduleFromSelected,
  syncNutrientAutoFields,
  type NutrientData,
  type NutrientKey
} from "../src/nutrients";

const keys: NutrientKey[] = ["fermO", "fermK", "dap", "other"];

/** The three auto-fill effects from the web NutrientProvider before #571, verbatim in behavior. */
function legacyEffectsOnce(data: NutrientData): NutrientData {
  let next = data;
  // Effect 1: YAN split when not adjusting.
  if (!next.adjustments.adjustAllowed) {
    const sg = parseNumber(next.inputs.sg);
    const offset = parseNumber(next.inputs.offsetPpm || "0");
    const n2 = next.selected.nitrogenRequirement;
    const n2Multiplier = n2 === "Very Low" ? 0.75 : n2 === "Low" ? 0.75 : n2 === "Medium" ? 0.9 : n2 === "High" ? 1.25 : 1.8;
    const target = Math.round(toBrix(sg) * sg * 10 * n2Multiplier - offset);
    const organic = next.inputs.goFermType === "none" ? 3 : 4;
    const contribution = {
      fermO: parseNumber(next.settings.yanContribution.fermO) * organic,
      fermK: parseNumber(next.settings.yanContribution.fermK),
      dap: parseNumber(next.settings.yanContribution.dap),
      other: parseNumber(next.settings.yanContribution.other) * (next.settings.other.usesOrganicMultiplier ? organic : 1)
    };
    const enabled = next.selected.selectedNutrients;
    let remaining = target;
    const provided: Record<NutrientKey, string> = { fermO: "0", fermK: "0", dap: "0", other: "0" };
    for (const key of keys) {
      if (remaining <= 0) continue;
      const cap = (contribution[key] || 0) * ((enabled[key] ? parseNumber(next.settings.maxGpl[key]) : 0) || 0);
      if (cap <= 0) continue;
      const use = Math.min(cap, remaining);
      provided[key] = String(use);
      remaining -= use;
    }
    next = { ...next, adjustments: { ...next.adjustments, providedYanPpm: provided } };
  }
  // Effect 2: max g/L from the schedule when not edited.
  if (!next.settings.maxGplTouched) {
    const maxGpl = getEffectiveMaxGpl({ schedule: next.selected.schedule, sg: next.inputs.sg, selected: next.selected.selectedNutrients });
    next = { ...next, settings: { ...next.settings, maxGpl: { ...next.settings.maxGpl, ...maxGpl } } };
  }
  // Effect 3: yeast amount when not typed.
  if (!next.inputs.yeastAmountTouched) {
    const volume = parseNumber(next.inputs.volume);
    const sg = parseNumber(next.inputs.sg);
    let multiplier = next.inputs.volumeUnits === "liter" ? 1 / 3.78541 : 1;
    if (sg >= 1.125) multiplier *= 4;
    else if (sg > 1.1 && sg < 1.125) multiplier *= 3;
    else multiplier *= 2;
    next = { ...next, inputs: { ...next.inputs, yeastAmountG: String(Math.round(volume * multiplier * 100) / 100) } };
  }
  return next;
}

function legacyFixedPoint(data: NutrientData) {
  let current = data;
  for (let i = 0; i < 5; i++) current = legacyEffectsOnce(current);
  return current;
}

test("auto fields match the web provider's previous effects across schedules and inputs", () => {
  const selections = [
    { fermO: true, fermK: false, dap: false, other: false },
    { fermO: true, fermK: true, dap: false, other: false },
    { fermO: true, fermK: true, dap: true, other: false },
    { fermO: false, fermK: true, dap: true, other: false },
    { fermO: false, fermK: false, dap: true, other: false },
    { fermO: true, fermK: false, dap: false, other: true },
    { fermO: false, fermK: false, dap: false, other: false }
  ];
  let cases = 0;
  for (const selectedNutrients of selections) {
    for (const sg of ["1.05", "1.09", "1.115", "1.13", ""]) {
      for (const nitrogenRequirement of ["Very Low", "Low", "Medium", "High", "Very High"] as const) {
        for (const goFermType of ["Go-Ferm", "none", "sterol-flash"] as const) {
          for (const [volume, volumeUnits] of [["5", "gal"], ["20", "liter"]] as const) {
            const data = initialNutrientData({
              inputs: { ...initialNutrientData().inputs, sg, goFermType, volume, volumeUnits, offsetPpm: "15" },
              selected: {
                ...initialNutrientData().selected,
                nitrogenRequirement,
                selectedNutrients,
                schedule: scheduleFromSelected(selectedNutrients)
              },
              settings: {
                ...initialNutrientData().settings,
                yanContribution: { fermO: "40", fermK: "100", dap: "210", other: "13.333333333333334" },
                other: { name: "BBY", usesOrganicMultiplier: true }
              }
            });
            assert.deepEqual(syncNutrientAutoFields(data), legacyFixedPoint(data));
            cases += 1;
          }
        }
      }
    }
  }
  assert.equal(cases, 7 * 5 * 5 * 3 * 2);
});

test("auto fields leave edited max g/L, manual YAN and a typed yeast amount alone", () => {
  let data = syncNutrientAutoFields(initialNutrientData({ inputs: { ...initialNutrientData().inputs, sg: "1.1" } }));
  data = applyNutrientAction(data, { type: "setMaxGpl", key: "fermO", value: "1.2" });
  data = applyNutrientAction(data, { type: "setAdjustAllowed", value: true });
  data = applyNutrientAction(data, { type: "setProvidedYanPpm", key: "fermO", value: "100" });
  data = applyNutrientAction(data, { type: "setYeastAmountG", value: "7" });
  const synced = syncNutrientAutoFields(data);
  assert.equal(synced, data, "returns the same object when nothing changes");
  assert.equal(synced.settings.maxGpl.fermO, "1.2");
  assert.equal(synced.adjustments.providedYanPpm.fermO, "100");
  assert.equal(synced.inputs.yeastAmountG, "7");

  const auto = syncNutrientAutoFields(applyNutrientAction(synced, { type: "resetYeastAmountAuto" }));
  assert.equal(auto.inputs.yeastAmountG, "2");
});

test("actions match the web provider's previous setters", () => {
  const yeasts = [
    { id: 1, brand: "Lalvin", name: "18-2007", nitrogen_requirement: "Low" as const },
    { id: 2, brand: "Lalvin", name: "71B", nitrogen_requirement: "Low" as const },
    { id: 9, brand: "Other", name: "Kveik Yeast", nitrogen_requirement: "Very High" as const }
  ];
  const base = initialNutrientData();

  const brand = applyNutrientAction(base, { type: "setYeastBrand", brand: "Other", yeasts });
  assert.deepEqual(
    [brand.selected.yeastBrand, brand.selected.yeastStrain, brand.selected.yeastId, brand.selected.nitrogenRequirement],
    ["Other", "Kveik Yeast", 9, "Very High"]
  );
  const unknownBrand = applyNutrientAction(base, { type: "setYeastBrand", brand: "Nope", yeasts });
  assert.deepEqual([unknownBrand.selected.yeastBrand, unknownBrand.selected.yeastStrain], ["Nope", "18-2007"]);

  const strain = applyNutrientAction(brand, { type: "setYeastStrain", strain: "71B", yeasts });
  assert.deepEqual([strain.selected.yeastBrand, strain.selected.yeastId, strain.selected.nitrogenRequirement], ["Lalvin", 2, "Low"]);

  const picked = applyNutrientAction(base, { type: "selectYeast", yeast: yeasts[2] });
  assert.deepEqual([picked.selected.yeastBrand, picked.selected.yeastStrain, picked.selected.yeastId], ["Other", "Kveik Yeast", 9]);

  const toggled = applyNutrientAction(base, { type: "toggleNutrient", key: "fermK" });
  assert.deepEqual(toggled.selected.selectedNutrients, { fermO: true, fermK: true, dap: false, other: false });
  assert.equal(toggled.selected.schedule, "oAndk");

  const preset = applyNutrientAction(base, {
    type: "selectOtherNutrientPreset",
    preset: { name: "Boiled Bread Yeast (BBY)", yan_ppm_per_gpl: 13.33333333333333, max_gpl: null, organic_multiplier: true }
  });
  assert.equal(preset.settings.yanContribution.other, "13.33333333333333");
  assert.equal(preset.settings.maxGpl.other, "3");
  assert.equal(preset.settings.maxGplTouched, true);
  assert.deepEqual(preset.settings.other, { name: "Boiled Bread Yeast (BBY)", usesOrganicMultiplier: true });

  assert.equal(applyNutrientAction(base, { type: "setMaxGpl", key: "dap", value: "1" }).settings.maxGplTouched, true);
  assert.equal(applyNutrientAction(base, { type: "setYeastAmountG", value: "5" }).inputs.yeastAmountTouched, true);
  assert.notEqual(applyNutrientAction(base, { type: "setSg", value: "1.1" }), base);
  assert.equal(base.inputs.sg, "1", "actions never mutate their input");
});

test("schedules follow the selected nutrients", () => {
  const s = (fermO: boolean, fermK: boolean, dap: boolean, other = false) => scheduleFromSelected({ fermO, fermK, dap, other });
  assert.equal(s(true, true, true), "tbe");
  assert.equal(s(true, true, false), "oAndk");
  assert.equal(s(true, false, true), "oAndDap");
  assert.equal(s(false, true, true), "kAndDap");
  assert.equal(s(true, false, false), "tosna");
  assert.equal(s(false, true, false), "justK");
  assert.equal(s(false, false, true), "dap");
  assert.equal(s(false, false, false), "other");
  assert.equal(s(true, true, true, true), "other");
});
