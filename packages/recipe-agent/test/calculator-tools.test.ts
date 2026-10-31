import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatorTools,
  calculatorToolNames,
  executeMcpAgentTool,
  executeHostedAgentTool,
  mcpAgentToolDefinitions,
  hostedAgentToolDefinitions,
  isMcpAccountReadTool
} from "../src/index";
import {
  calcABV,
  toBrix,
  toSG,
  temperatureCorrection,
  refractometerCorrectedSg,
  blendValues,
  benchTrial
} from "@meadtools/core";

const samples: Record<string, object> = {
  calculate_juice_sugar: { sugar: 24, servingSize: 240, servings: 4 },
  calculate_abv: { originalGravity: 1.1, finalGravity: 1 },
  convert_brix_gravity: { reading: 1.1, unit: "SG" },
  estimate_original_gravity: { hydrometerFg: 1, refractometerFgBrix: 5 },
  calculate_sulfite: { volume: 1 },
  calculate_sorbate: { volume: 1, abvPercent: 12 },
  correct_refractometer: { originalReading: 1.1, finalBrix: 8.5 },
  correct_hydrometer_temperature: {
    specificGravity: 1.1,
    measuredTemperature: 80
  },
  calculate_blend: {
    rows: [
      { value: 1.1, volume: 1 },
      { value: 1, volume: 2 }
    ],
    valueUnit: "SG",
    volumeUnit: "L"
  },
  calculate_priming_sugar: { volume: 5 },
  calculate_bottling: { volume: 5, rows: [{ size: "750ml", quantity: 10 }] },
  calculate_bench_trial: {
    stockVolumeMl: 1,
    concentrationPercent: 10,
    sampleMl: 100,
    batchSize: 5
  }
};
async function values(name: string, input = samples[name]) {
  const execution = await executeMcpAgentTool(name, input);
  assert.equal(execution.status, "ok", JSON.stringify(execution));
  assert.ok(
    "result" in execution && execution.result && "values" in execution.result
  );
  return execution.result.values as Record<string, number>;
}
function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
}

test("every standalone calculator is registered once, shared with hosted chat, and stateless", async () => {
  assert.equal(calculatorToolNames.length, 12);
  assert.equal(
    new Set(mcpAgentToolDefinitions.map((t) => t.name)).size,
    mcpAgentToolDefinitions.length
  );
  assert.equal(
    mcpAgentToolDefinitions.filter((t) => t.name === "calculate_gravity_target")
      .length,
    1
  );
  for (const tool of calculatorTools) {
    assert.equal(isMcpAccountReadTool(tool.name), false);
    assert.ok(mcpAgentToolDefinitions.some((t) => t.name === tool.name));
    assert.ok(hostedAgentToolDefinitions.some((t) => t.name === tool.name));
    assert.equal(tool.parameters.additionalProperties, false);
    assert.equal(tool.outputSchema.type, "object");
    assert.deepEqual(
      await executeMcpAgentTool(tool.name, samples[tool.name]),
      await executeHostedAgentTool(tool.name, samples[tool.name])
    );
    const result = await tool.execute(samples[tool.name]);
    assert.equal(result.status, "ok");
    await values(tool.name);
    assert.equal(
      tool.execute({ ...samples[tool.name], userId: 1 }).status,
      "invalid_input"
    );
    assert.equal(tool.execute({}).status, "invalid_input");
  }
});

test("gravity calculators agree with web formula paths and OG estimation stays distinct from target planning", async () => {
  const abv = await values("calculate_abv");
  near(abv.abvPercent, calcABV(1.1, 1));
  near(abv.delle, toBrix(1) + 4.5 * calcABV(1.1, 1));
  near((await values("convert_brix_gravity")).brix, toBrix(1.1));
  near(
    (await values("convert_brix_gravity", { reading: 24, unit: "Brix" }))
      .specificGravity,
    toSG(24)
  );
  const estimated = await values("estimate_original_gravity");
  assert.equal(
    estimated.originalGravity,
    Math.round((-1.728 + 0.01085 * 5 + 2.728) * 1000) / 1000
  );
  near(estimated.abvPercent, calcABV(estimated.originalGravity, 1));
  const ref = await values("correct_refractometer");
  near(ref.correctedGravity, refractometerCorrectedSg(toBrix(1.1), 8.5, 1));
  near(
    (
      await values("correct_refractometer", {
        originalReading: toBrix(1.1),
        originalUnit: "Brix",
        finalBrix: 8.5
      })
    ).correctedGravity,
    ref.correctedGravity
  );
  near(
    (
      await values("correct_refractometer", {
        originalReading: 1.1,
        finalBrix: 8.5,
        correctionFactor: 1.04
      })
    ).correctedGravity,
    refractometerCorrectedSg(toBrix(1.1), 8.5, 1.04)
  );
});

test("sulfite and sorbate preserve web conversion constants, types, and zero boundaries", async () => {
  const sulfite = await values("calculate_sulfite");
  near(sulfite.sulfiteGrams, (3.785 * 50) / 570);
  near(sulfite.campdenTablets, 50 / 75);
  near(
    (await values("calculate_sulfite", { volume: 3.785, volumeUnit: "lit" }))
      .sulfiteGrams,
    sulfite.sulfiteGrams
  );
  near(
    (await values("calculate_sulfite", { volume: 2, type: "naMeta", ppm: 75 }))
      .sulfiteGrams,
    (2 * 3.785 * 75) / 674
  );
  near(
    (await values("calculate_sorbate")).sorbateGrams,
    ((400 - 12 * 25) / 0.75) * 0.003785411784
  );
  near(
    (
      await values("calculate_sorbate", {
        volume: 3.785411784,
        volumeUnit: "lit",
        abvPercent: 12
      })
    ).sorbateGrams,
    (await values("calculate_sorbate")).sorbateGrams
  );
  assert.equal(
    (await values("calculate_sorbate", { volume: 5, abvPercent: 16 }))
      .sorbateGrams,
    0
  );
  assert.equal(
    (await values("calculate_sulfite", { volume: 0 })).sulfiteGrams,
    0
  );
});

test("temperature correction defaults follow units; weighted blending matches web", async () => {
  near(
    (await values("correct_hydrometer_temperature")).correctedGravity,
    temperatureCorrection(1.1, 80, 68)
  );
  assert.equal(
    (
      await values("correct_hydrometer_temperature", {
        specificGravity: 1.1,
        measuredTemperature: 20,
        temperatureUnit: "C"
      })
    ).correctedGravity,
    1.1
  );
  near(
    (await values("calculate_blend")).blendedValue,
    blendValues([
      [1.1, 1],
      [1, 2]
    ]).blendedValue
  );
});

test("priming reproduces original polynomial, sugar-content adjustment, conversions and bottle doses", async () => {
  const result = await values("calculate_priming_sugar");
  const expected =
    15.195 * 5 * (2.4 - 3.0378 + 5.0062e-2 * 68 - 2.6555e-4 * 68 ** 2);
  near(result.sugarGrams, expected);
  near(result.gramsPer12oz, ((expected / 5) * 12) / 128);
  near(
    (
      await values("calculate_priming_sugar", {
        volume: 5 * 3.78541,
        volumeUnit: "lit",
        temperature: 20,
        temperatureUnit: "C"
      })
    ).sugarGrams,
    expected
  );
  near(
    (
      await values("calculate_priming_sugar", {
        volume: 5,
        sugarContentPercent: 50
      })
    ).sugarGrams,
    expected * 2
  );
  assert.equal(
    (await values("calculate_priming_sugar", { volume: 0 })).gramsPer12oz,
    0
  );
});

test("bottling mixed/custom rows preserves nominal sizes, over-allocation and round-up behavior", async () => {
  const result = await values("calculate_bottling");
  near(result.totalBottledLiters, 7.5);
  near(result.remainingLiters, 5 * 3.78541 - 7.5);
  assert.equal(result.row1BottlesToFill, Math.ceil((5 * 3.78541) / 0.75));
  const custom = await values("calculate_bottling", {
    volume: 1,
    volumeUnit: "lit",
    rows: [
      { size: "custom", quantity: 3, customSize: 500, customUnit: "ml" },
      { size: "750ml", quantity: 0 }
    ]
  });
  assert.equal(custom.remainingLiters, -0.5);
  assert.equal(custom.row2BottlesToFill, 0);
  for (const [customUnit, customSize] of [
    ["liter", 1],
    ["gallon", 1 / 3.78541],
    ["fl_oz", 33.814]
  ] as const) {
    near(
      (
        await values("calculate_bottling", {
          volume: 1,
          volumeUnit: "lit",
          rows: [{ size: "custom", quantity: 1, customSize, customUnit }]
        })
      ).totalBottledLiters,
      1
    );
  }
});

test("bench trials preserve web intermediate rounding for liters and gallons", async () => {
  for (const batchUnit of ["liter", "gallon"] as const) {
    const input = {
      stockVolumeMl: 1.5,
      concentrationPercent: 10,
      sampleMl: 100,
      batchSize: 5,
      batchUnit
    };
    assert.deepEqual(
      await values("calculate_bench_trial", input),
      benchTrial(1.5, 10, 100, 5, batchUnit)
    );
  }
});

test("invalid and unsupported combinations return useful deterministic errors", async () => {
  for (const [name, input] of [
    ["convert_brix_gravity", { reading: 10, unit: "SG" }],
    ["calculate_sorbate", { volume: 1, abvPercent: 17 }],
    ["calculate_sulfite", { volume: -1 }],
    ["calculate_sulfite", { volume: Infinity }],
    [
      "correct_refractometer",
      { originalReading: 1.1, finalBrix: 8, correctionFactor: 0 }
    ],
    [
      "correct_refractometer",
      { originalReading: 1.1, finalBrix: 8, finalUnit: "SG" }
    ],
    [
      "calculate_blend",
      {
        rows: [
          { value: 1, volume: 0 },
          { value: 1, volume: 0 }
        ],
        valueUnit: "SG",
        volumeUnit: "L"
      }
    ],
    ["calculate_priming_sugar", { volume: 1, co2Volumes: 0 }],
    ["calculate_priming_sugar", { volume: 1, temperature: 120 }],
    ["calculate_priming_sugar", { volume: 1, sugarContentPercent: 0 }],
    [
      "calculate_bottling",
      { volume: 1, rows: [{ size: "unknown", quantity: 1 }] }
    ],
    [
      "calculate_bottling",
      { volume: 1, rows: [{ size: "custom", quantity: 1 }] }
    ],
    [
      "calculate_bottling",
      { volume: 1, rows: [{ size: "750ml", quantity: 0.5 }] }
    ],
    [
      "calculate_bench_trial",
      { stockVolumeMl: 0, concentrationPercent: 10, sampleMl: 0, batchSize: 1 }
    ],
    [
      "correct_hydrometer_temperature",
      { specificGravity: 1, measuredTemperature: -300 }
    ]
  ] as const) {
    const result = await executeMcpAgentTool(name, input);
    assert.equal(result.status, "invalid_input", name);
    assert.ok("issues" in result && result.issues.length > 0);
  }
});

test("juice labels derive concentration separately from Brix conversion and preserve displayed mass units", async () => {
  const result = await values("calculate_juice_sugar");
  assert.equal(result.brix, 10);
  assert.equal(result.specificGravity, Math.round(toSG(10) * 1000) / 1000);
  assert.equal(result.totalSugar, 96);
  const mg = await values("calculate_juice_sugar", {
    sugar: 24000,
    sugarUnit: "mg",
    servingSize: 240,
    servings: 4
  });
  assert.equal(mg.brix, 10);
  assert.equal(mg.totalSugar, 96000);
  const floz = await values("calculate_juice_sugar", {
    sugar: 24,
    servingSize: 240 / 29.5735,
    servingUnit: "floz"
  });
  assert.equal(floz.brix, 10);
});

test("main stabilizer pH lookup reuses sulfite tool, with explicit alternatives", async () => {
  assert.equal(
    (await values("calculate_sulfite", { volume: 1, ph: 3.76 })).ppm,
    98
  );
  const invalid = await executeMcpAgentTool("calculate_sulfite", {
    volume: 1,
    ph: 3.6,
    ppm: 50
  });
  assert.equal(invalid.status, "invalid_input");
});


test("discovery keeps calculator defaults optional for MCP clients", () => {
  const priming = calculatorTools.find(tool => tool.name === "calculate_priming_sugar")!;
  assert.deepEqual(priming.parameters.required, ["volume"]);
  const properties = priming.parameters.properties as Record<string, { default?: unknown }>;
  assert.equal(properties.volumeUnit.default, "gal");
  assert.equal(properties.temperatureUnit.default, "F");
  assert.equal(properties.co2Volumes.default, 2.4);
  assert.equal(properties.sugarContentPercent.default, 100);
  const sulfite = calculatorTools.find(tool => tool.name === "calculate_sulfite")!;
  assert.deepEqual(sulfite.parameters.required, ["volume"]);
  assert.equal(sulfite.execute({ volume: 1 }).status, "ok");
});
