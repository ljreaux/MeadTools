import assert from "node:assert/strict";
import test from "node:test";
import { initialNutrientData, toSG } from "@meadtools/core";
import { buildRecipeDraft } from "@meadtools/recipe-workflows";
import { recipeEvaluationTools } from "../src/recipe-evaluation-tools";

const [volume, evaluate] = recipeEvaluationTools;
const juice = {
  name: "Apple juice",
  stage: "secondary",
  brix: 12,
  amount: { kind: "volume", value: 32, unit: "fl_oz" },
};
const water = {
  name: "Water",
  stage: "primary",
  amount: { kind: "volume", value: 4, unit: "L" },
};
const honey = {
  name: "Honey",
  stage: "primary",
  amount: { kind: "weight", value: 1, unit: "kg" },
};
const noLoss = { kind: "percent", value: 0 };

function result<T>(
  execution: { status: "ok"; result: T } | { status: "invalid_input" },
) {
  assert.equal(execution.status, "ok");
  return execution.result;
}

function near(value: number | null, expected: number, tolerance = 1e-10) {
  assert.ok(
    value !== null && Math.abs(value - expected) < tolerance,
    `${value} != ${expected}`,
  );
}

test("a fixed US liquid addition is available before the racked basis is known", () => {
  const estimate = result(
    volume.execute({
      ingredients: [juice],
      target: { stage: "postAddition", value: 5, unit: "L" },
    }),
  );
  near(estimate.stages.secondary.liters, 0.946352946);
  assert.equal(estimate.stages.postAddition.liters, null);
  assert.equal(estimate.stages.postAddition.missing[0].field, "rackedVolume");
  assert.equal(estimate.target?.deltaL, null);
  assert.equal(estimate.draftBatchVolume, null);
});

test("racked measurements, imperial units, and a packaging loss use separate stages", () => {
  const estimate = result(
    volume.execute({
      ingredients: [
        { ...juice, amount: { kind: "volume", value: 1, unit: "imp_gal" } },
      ],
      rackedVolume: { value: 1, unit: "gal", source: "measurement" },
      packagingLoss: { kind: "volume", amount: { value: 0.5, unit: "L" } },
      target: { stage: "packaging", value: 8, unit: "L" },
    }),
  );
  assert.equal(estimate.stages.racked.source, "measurement");
  near(estimate.stages.postAddition.liters, 8.331501784);
  near(estimate.stages.packaging.liters, 7.831501784);
  near(estimate.target?.deltaL ?? null, -0.168498216);
});

test("weighed ingredients and displacement retain their respective bases", () => {
  const fruit = {
    name: "Berries",
    kind: "fruit",
    stage: "primary",
    amount: { kind: "weight", unit: "kg", value: 1 },
    solidsDisplacement: { value: 0.25, unit: "L" },
  };
  const syrup = { ...honey, name: "Syrup", densityKgPerL: 1.25 };
  const options = {
    primaryLoss: { kind: "percent", value: 10 },
    packagingLoss: { kind: "percent", value: 20 },
  };
  const partial = result(
    volume.execute({ ingredients: [water, syrup, fruit], ...options }),
  );
  near(partial.ingredients[1].liquidLiters, 0.8);
  near(partial.stages.primary.knownSubtotalL, 4.8);
  assert.equal(
    partial.stages.primary.missing[0].field,
    "ingredients[2].densityKgPerL",
  );
  assert.equal(partial.stages.primary.liters, null);

  const complete = result(
    volume.execute({
      ingredients: [water, syrup, { ...fruit, brix: 12 }, juice],
      ...options,
    }),
  );
  const fruitLiters = 1 / toSG(12);
  near(complete.ingredients[2].liquidLiters, fruitLiters);
  assert.equal(complete.ingredients[2].solidsDisplacementL, 0.25);
  const primaryLiters = 4.8 + fruitLiters;
  const rackedLiters = primaryLiters * 0.9;
  near(complete.stages.racked.liters, rackedLiters);
  near(complete.stages.postAddition.liters, rackedLiters + 0.946352946);
  near(complete.stages.packaging.liters, (rackedLiters + 0.946352946) * 0.8);
  near(complete.draftBatchVolume?.value ?? null, primaryLiters + 0.946352946);
});

test("strictly validates fixed inputs and reports missing density separately", () => {
  assert.equal(
    volume.execute({
      ingredients: [{ ...juice, amount: { ...juice.amount, extra: true } }],
    }).status,
    "invalid_input",
  );
  assert.equal(
    volume.execute({
      ingredients: [juice],
      rackedVolume: { value: 4, unit: "L" },
      primaryLoss: noLoss,
    }).status,
    "invalid_input",
  );
  const partial = result(
    volume.execute({ ingredients: [{ ...honey, name: "Unknown syrup" }] }),
  );
  assert.equal(
    partial.ingredients[0].missing[0].field,
    "ingredients[0].densityKgPerL",
  );
  assert.equal(
    evaluate.execute({ ingredients: [water], claims: { volume: 1 } }).status,
    "invalid_input",
  );
});

test("native drafts and equivalent outside recipes agree with the volume tool", () => {
  const ingredients = [water, honey, juice];
  const options = { primaryLoss: noLoss, packagingLoss: noLoss };
  const volumeEstimate = result(volume.execute({ ingredients, ...options }));
  assert.ok(volumeEstimate.draftBatchVolume);
  const draft = buildRecipeDraft({
    name: "Synthetic apple mead",
    batchVolume: volumeEstimate.draftBatchVolume,
    fermentationFinalGravity: 1,
    allowWaterFill: false,
    stabilizers: { enabled: false },
    nutrients: {
      enabled: true,
      yeastBrand: "Lalvin",
      yeastStrain: "18-2007",
      nitrogenRequirement: "Low",
      schedule: "tosna",
      numberOfAdditions: 1,
      goFermType: "Go-Ferm",
    },
    ingredients: ingredients.map(({ name, stage, amount, ...row }) => ({
      ...row,
      name,
      secondary: stage === "secondary",
      amount,
      role: "fixed",
    })),
  });
  assert.equal(draft.status, "recipe", JSON.stringify(draft));
  const defaults = initialNutrientData();
  const nutrients = {
    ...defaults,
    inputs: { ...defaults.inputs, volume: "99", sg: "1.300" },
  };
  const structured = result(
    evaluate.execute({
      ingredients,
      ...options,
      nutrients,
      claims: { fermentationFg: 1, primaryOg: { value: 13, unit: "Brix" } },
    }),
  );
  const invalid = evaluate.execute({
    recipeData: {
      ...draft.recipeData,
      unitDefaults: { ...draft.recipeData.unitDefaults, extra: true },
    },
  });
  assert.equal(invalid.status, "invalid_input");
  const snapshot = result(
    evaluate.execute({ recipeData: { ...draft.recipeData, nutrients } }),
  );
  assert.deepEqual(structured.volume.stages, volumeEstimate.stages);
  assert.equal(
    structured.nutrients.basis?.primaryVolumeL,
    volumeEstimate.stages.primary.liters,
  );
  assert.deepEqual(snapshot.nutrients.result, structured.nutrients.result);
  assert.match(structured.assumptions.join(" "), /replacing the nutrient form/);
  near(
    snapshot.volume.stages.postAddition.liters,
    structured.volume.stages.postAddition.liters!,
    0.001,
  );
  near(snapshot.primaryOg.value, structured.primaryOg.value!, 0.0001);
  near(
    snapshot.finishedAbvPercent.value,
    structured.finishedAbvPercent.value!,
    0.02,
  );
  near(
    structured.comparisons.find((row) => row.field === "primaryOg")?.claimed ??
      null,
    toSG(13),
  );
  assert.equal(
    structured.comparisons.find((row) => row.field === "fermentationFg")?.delta,
    null,
  );

  const beforeSecondary = result(
    evaluate.execute({
      ingredients: [water, honey],
      ...options,
      nutrients,
      claims: { fermentationFg: 1 },
    }),
  );
  assert.deepEqual(beforeSecondary.primaryOg, structured.primaryOg);
  assert.deepEqual(beforeSecondary.nutrients, structured.nutrients);
  assert.ok(
    structured.finishedAbvPercent.value! <
      beforeSecondary.finishedAbvPercent.value!,
  );
});

test("unresolved primary calculations still allow stabilizer scenarios", () => {
  const output = result(
    evaluate.execute({
      ingredients: [{ ...juice, stage: "primary", brix: undefined }],
      measurements: { fermentationFg: 1.002 },
      claims: {
        fermentationFg: 1,
        volumes: [{ stage: "racked", value: 1, unit: "gal" }],
      },
      rackedVolume: { value: 4, unit: "L", source: "recipeClaim" },
      stabilizers: [16, 16.1].map((abvPercent) => ({
        stage: "racked",
        abvPercent,
        ph: 3.5,
      })),
    }),
  );
  assert.equal(output.primaryOg.value, null);
  assert.equal(output.nutrients.result, null);
  near(output.comparisons[0].delta, 4 - 3.785411784);
  near(output.comparisons[1].delta, 0.002);
  assert.equal(output.comparisons[1].referenceSource, "measurement");
  assert.equal(output.comparisons[0].referenceSource, "recipeClaim");
  assert.equal(output.volume.stages.racked.source, "recipeClaim");
  assert.equal(output.stabilizers[0].volumeL.source, "recipeClaim");
  assert.equal(output.stabilizers[0].abvPercent.source, "assumption");
  assert.match(
    output.assumptions.join(" "),
    /zero sorbate at 16%.*formula boundary/i,
  );
  assert.equal(output.stabilizers[0].sorbateGrams.value, 0);
  assert.equal(output.stabilizers[1].sorbateGrams.value, null);
  assert.match(
    output.stabilizers[1].sorbateGrams.missing[0].reason,
    /up to 16%/,
  );
  assert.ok(output.stabilizers[1].sulfiteGrams.value! > 0);
});

test("unmeasured cooked honey records its MeadTools proxy", () => {
  const estimate = result(
    evaluate.execute({
      ingredients: [{ ...honey, name: "Cooked honey" }, water],
    }),
  );
  assert.match(
    estimate.volume.ingredients[0].assumptions.join(" "),
    /proxy.*cooking/i,
  );
});

test("unlabeled volume bases and explicit stabilizer scenarios are assumptions", () => {
  const rackedVolume = { value: 4, unit: "L" };
  const ingredients = [water, juice];
  const standalone = result(volume.execute({ ingredients, rackedVolume }));
  assert.equal(standalone.stages.racked.source, "assumption");
  const output = result(
    evaluate.execute({
      ingredients,
      measurements: {
        volumes: [{ stage: "racked", ...rackedVolume }],
        primaryAbvPercent: 15,
      },
      stabilizers: [
        { stage: "racked", ph: 3.5 },
        {
          stage: "racked",
          volume: { value: 5, unit: "L" },
          abvPercent: 16,
          abvSource: "recipeClaim",
          ph: 3.5,
        },
      ],
    }),
  );
  assert.equal(output.volume.stages.racked.source, "measurement");
  assert.equal(output.stabilizers[0].volumeL.source, "measurement");
  assert.equal(output.stabilizers[0].abvPercent.source, "measurement");
  assert.equal(output.stabilizers[1].volumeL.source, "assumption");
  assert.equal(output.stabilizers[1].abvPercent.source, "recipeClaim");
  near(output.stabilizers[0].sulfiteGrams.value, (4 * 39) / 570);
  near(output.stabilizers[1].sulfiteGrams.value, (5 * 39) / 570);
});

test("a missing density for weighed fruit reaches the nutrient result once", () => {
  const output = result(
    evaluate.execute({
      ingredients: [
        water,
        {
          name: "Plums",
          kind: "fruit",
          stage: "primary",
          amount: { kind: "weight", value: 1, unit: "kg" },
        },
      ],
      claims: { fermentationFg: 1 },
      nutrients: initialNutrientData(),
    }),
  );
  assert.deepEqual(
    output.nutrients.missing.map(({ field }) => field),
    ["ingredients[1].densityKgPerL"],
  );
});

test("supplied Brix on bochet honey still records the cooking approximation", () => {
  const output = result(
    volume.execute({
      ingredients: [{ ...honey, name: "Bochet honey", brix: 75 }],
    }),
  );
  near(output.ingredients[0].specificGravity, toSG(75));
  assert.match(
    output.ingredients[0].assumptions.join(" "),
    /cooking-specific fermentability/,
  );
});

test("native fruit preserves authored amounts and the builder’s stored volume", () => {
  const nutrients = initialNutrientData();
  const fruit = {
    name: "Plums",
    kind: "fruit",
    stage: "primary",
    brix: 13,
    amount: { kind: "weight", value: 2, unit: "lb" },
  };
  const options = {
    primaryLoss: { kind: "percent", value: 10 },
    packagingLoss: { kind: "percent", value: 5 },
    stabilizers: [
      { stage: "racked", ph: 3.5 },
      { stage: "postAddition", ph: 3.5 },
    ],
  };
  const ingredients = [water, fruit, honey, juice];
  const structured = result(
    evaluate.execute({
      ...options,
      ingredients,
      nutrients,
      claims: { fermentationFg: 1 },
    }),
  );
  const snapshot = result(
    evaluate.execute({
      ...options,
      recipeData: {
        version: 2,
        unitDefaults: { weight: "kg", volume: "L" },
        ingredients: [
          {
            lineId: "water",
            name: water.name,
            ref: { kind: "custom" },
            secondary: false,
            category: "water",
            brix: "0",
            amounts: {
              basis: "volume",
              volume: { value: "4", unit: "L" },
              weight: { value: "0", unit: "kg" },
            },
          },
          {
            lineId: "fruit",
            name: fruit.name,
            ref: { kind: "custom" },
            secondary: false,
            category: "fruit",
            brix: "13",
            amounts: {
              basis: "weight",
              volume: { value: "99", unit: "L" },
              weight: { value: "2", unit: "lb" },
            },
          },
          {
            lineId: "honey",
            name: honey.name,
            ref: { kind: "custom" },
            secondary: false,
            category: "sugar",
            brix: "79.6",
            amounts: {
              basis: "weight",
              volume: { value: "0", unit: "L" },
              weight: { value: "1", unit: "kg" },
            },
          },
          {
            lineId: "juice",
            name: juice.name,
            ref: { kind: "custom" },
            secondary: true,
            category: "juice",
            brix: String(juice.brix),
            amounts: {
              basis: "volume",
              volume: { value: "32", unit: "fl_oz" },
              weight: { value: "0", unit: "kg" },
            },
          },
        ],
        fg: "1",
        nutrients,
        additives: [],
        notes: { primary: [], secondary: [] },
        stabilizers: {
          adding: false,
          takingPh: false,
          phReading: "",
          type: "kmeta",
        },
      },
    }),
  );
  near(snapshot.volume.stages.primary.liters, 103);
  near(snapshot.volume.stages.racked.liters, 92.7);
  assert.deepEqual(snapshot.volume.ingredients[1].amount, {
    kind: "weight",
    unit: "lb",
    value: 2,
  });
  assert.equal(snapshot.volume.ingredients[1].liquidLiters, 99);
  assert.notEqual(snapshot.primaryOg.value, structured.primaryOg.value);
  assert.deepEqual(snapshot.comparisons, []);
  assert.equal(snapshot.volume.ingredients[1].specificGravity, toSG(13));
  assert.equal(snapshot.volume.ingredients[1].solidsDisplacementL, null);
});

test("waterless berry draft, volume calculator, and native evaluation agree after primary loss", () => {
  const draft = buildRecipeDraft({
    batchVolume: { value: 2, unit: "gal" },
    lossAdjustment: { enabled: true, mode: "manual", percentage: 50 },
    fermentationFinalGravity: 1.05,
    targetOriginalGravity: 1.15,
    allowWaterFill: false,
    ingredients: [
      { name: "Berries", brix: 10, category: "fruit", role: "fill_liquid" },
      { name: "Honey", role: "adjustable_fermentable" },
    ],
    nutrients: {
      enabled: true,
      yeastBrand: "Lalvin",
      yeastStrain: "71B",
      nitrogenRequirement: "Low",
      schedule: "tosna",
      numberOfAdditions: 4,
      goFermType: "Go-Ferm",
    },
    stabilizers: { enabled: false },
  });
  assert.equal(draft.status, "recipe", JSON.stringify(draft));
  const ingredients = draft.recipeData.ingredients.map((line) => ({
    name: line.name,
    stage: "primary",
    kind: line.category === "fruit" ? "fruit" : "liquid",
    brix: Number(line.brix),
    amount: {
      ...line.amounts.weight,
      kind: "weight",
      value: Number(line.amounts.weight.value),
    },
  }));
  const estimate = result(
    volume.execute({
      ingredients,
      primaryLoss: { kind: "percent", value: 50 },
      packagingLoss: noLoss,
    }),
  );
  const native = result(evaluate.execute({ recipeData: draft.recipeData }));
  // The draft fill liquid stores a rounded volume. The volume call uses
  // its rounded weight to verify the documented fruit conversion.
  for (const stage of [
    "primary",
    "secondary",
    "racked",
    "postAddition",
    "packaging",
  ] as const) {
    near(
      estimate.stages[stage].liters,
      native.volume.stages[stage].liters!,
      0.00001,
    );
  }
  near(estimate.stages.primary.liters, draft.derived.volume.primaryL, 0.00001);
  near(estimate.stages.packaging.liters, 7.570823568, 0.00001);
  near(native.primaryOg.value, 1.15, 0.00001);
});

test("native stabilization uses the stored default pH with manual pH entry off", () => {
  const draft = buildRecipeDraft({
    batchVolume: { value: 5, unit: "L" },
    targetOriginalGravity: 1.08,
    fermentationFinalGravity: 1,
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    nutrients: {
      enabled: true,
      yeastBrand: "Lalvin",
      yeastStrain: "71B",
      nitrogenRequirement: "Low",
      schedule: "tosna",
      numberOfAdditions: 4,
      goFermType: "Go-Ferm",
    },
    stabilizers: { enabled: true, type: "kmeta", phReading: 3.6 },
  });
  assert.equal(draft.status, "recipe", JSON.stringify(draft));
  const output = result(
    evaluate.execute({
      recipeData: {
        ...draft.recipeData,
        stabilizers: { ...draft.recipeData.stabilizers, takingPh: false },
      },
    }),
  );
  const scenario = output.stabilizers[0];
  assert.equal(scenario.stage, "postAddition");
  assert.deepEqual(scenario.sulfiteBasis, { ph: 3.6, ppm: 50 });
  near(scenario.sulfiteGrams.value, draft.derived.stabilizers.sulfite, 0.00001);
  near(scenario.campdenTablets.value, draft.derived.stabilizers.campden, 0.001);
  assert.deepEqual(scenario.sulfiteGrams.missing, []);
});

test("models plain spring water and rejects sugars classified as inert solids", () => {
  const springWater = { ...water, name: "Spring water" };
  const check = result(evaluate.execute({ ingredients: [springWater, honey] }));
  assert.ok(check.primaryOg.value! > 1);
  const overridden = result(
    volume.execute({ ingredients: [{ ...springWater, brix: 5 }] }),
  );
  assert.equal(overridden.ingredients[0].specificGravity, toSG(5));
  const sugar = { ...honey, name: "Table sugar" };
  assert.equal(
    volume.execute({ ingredients: [{ ...sugar, kind: "solid" }] }).status,
    "invalid_input",
  );
  assert.equal(
    evaluate.execute({
      ingredients: [
        { ...sugar, name: "Sweet powder", kind: "solid", brix: 100 },
      ],
    }).status,
    "invalid_input",
  );
  const blend = result(
    evaluate.execute({ ingredients: [springWater, { ...sugar, brix: 100 }] }),
  );
  const sugarSg = toSG(100);
  const sugarLiters = 1 / sugarSg;
  near(
    blend.primaryOg.value,
    (4 * toSG(0) + sugarLiters * sugarSg) / (4 + sugarLiters),
  );
});

test("a measured racked volume replaces planned loss for stage totals and stabilizers", () => {
  const output = result(
    evaluate.execute({
      ingredients: [water, honey, juice],
      claims: { fermentationFg: 1 },
      measurements: { volumes: [{ stage: "racked", value: 3, unit: "L" }] },
      primaryLoss: { kind: "percent", value: 20 },
      packagingLoss: noLoss,
      stabilizers: [
        { stage: "racked", ph: 3.5 },
        { stage: "postAddition", ph: 3.5 },
      ],
    }),
  );
  assert.equal(output.volume.stages.racked.liters, 3);
  assert.equal(output.volume.stages.racked.source, "measurement");
  assert.equal(output.stabilizers[0].volumeL.value, 3);
  near(output.stabilizers[1].volumeL.value, 3 + 0.946352946);
  near(
    output.finishedAbvPercent.value,
    (output.primaryAbvPercent.value! * 3) / (3 + 0.946352946),
  );
  assert.match(
    output.assumptions.join(" "),
    /replaces the planned primary loss/,
  );
});

test("native snapshots can use stored volume with unknown Brix and compare FG when measured", () => {
  const output = result(
    evaluate.execute({
      recipeData: {
        version: 2,
        unitDefaults: { weight: "kg", volume: "L" },
        fg: "1",
        ingredients: [
          {
            lineId: "fruit",
            name: "Plums",
            category: "fruit",
            secondary: false,
            brix: "",
            ref: { kind: "custom" },
            amounts: {
              basis: "weight",
              weight: { value: "1", unit: "kg" },
              volume: { value: "0.9", unit: "L" },
            },
          },
        ],
        additives: [],
        notes: { primary: [], secondary: [] },
        stabilizers: {
          adding: false,
          takingPh: false,
          phReading: "3.6",
          type: "kmeta",
        },
      },
      measurements: { fermentationFg: 1.005 },
    }),
  );
  near(output.volume.stages.primary.liters, 0.9);
  assert.equal(output.primaryOg.value, null);
  assert.equal(output.primaryOg.missing[0].field, "ingredients[0].brix");
  assert.equal(output.primaryAbvPercent.value, null);
  assert.equal(output.comparisons[0].field, "fermentationFg");
  near(output.comparisons[0].delta, 0.005);
});
