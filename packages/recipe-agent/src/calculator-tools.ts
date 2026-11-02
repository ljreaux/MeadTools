import { z } from "zod";
import {
  standaloneAlcohol as alcohol,
  toBrix,
  toSG,
  refractometerCorrectedSg,
  temperatureCorrection,
  toFahrenheit,
  blendValues,
  estimatedOriginalGravity,
  sulfiteAddition,
  sorbateAddition,
  primingSugarBase,
  primingBottleSizes,
  juiceLabelEstimate,
  sulfitePpmForPh,
  benchTrial,
  bottleBreakdown,
  bottlesToFill,
  bottleVolumeLiters,
  BOTTLE_SIZES_L
} from "@meadtools/core";

const n = z.number(); // Zod rejects NaN and Infinity.
const sg = n.min(0.8).max(1.6).describe("Specific gravity (SG).");
const brix = n.min(0).max(100).describe("Degrees Brix.");
const volume = n.nonnegative().max(1e9);
const volumeUnit = z
  .enum(["gal", "lit"])
  .default("gal")
  .describe("US gallons or liters.");
const temperatureUnit = z.enum(["F", "C"]).default("F");
/** Explicit result keys are part of discovery, not just free-form prose. */
const outputFields: Record<string, string[]> = {
  calculate_juice_sugar: ["brix", "specificGravity", "totalSugar"],
  calculate_abv: ["abvPercent", "delle"],
  convert_brix_gravity: ["specificGravity", "brix"],
  estimate_original_gravity: [
    "originalGravity",
    "originalBrix",
    "abvPercent",
    "delle"
  ],
  calculate_sulfite: ["sulfiteGrams", "campdenTablets", "ppm"],
  calculate_sorbate: ["sorbateGrams"],
  correct_refractometer: [
    "correctedGravity",
    "correctedBrix",
    "abvPercent",
    "delle"
  ],
  correct_hydrometer_temperature: ["correctedGravity", "correctedBrix"],
  calculate_blend: ["blendedValue", "totalVolume"],
  calculate_priming_sugar: [
    "sugarGrams",
    ...primingBottleSizes.map((b) => `gramsPer${b.label.replaceAll(" ", "")}`)
  ],
  calculate_bottling: ["totalBottledLiters", "remainingLiters"],
  calculate_bench_trial: [
    "adjunctAmount",
    "adjunctConcentration",
    "scaledAdjunct",
    "scaledBatch"
  ]
};
function calculatorOutputSchema(name: string) {
  const fields = Object.fromEntries(outputFields[name].map((key) => [key, n]));
  const values = z.object(fields);
  return z.object({
    status: z.literal("ok"),
    result: z.object({
      values:
        name === "calculate_bottling"
          ? values
              .catchall(n)
              .describe(
                "Also returns row1BottlesToFill, row2BottlesToFill, etc., one integer bottle count for each supplied row."
              )
          : values.strict(),
      units: z
        .record(z.string(), z.string())
        .describe("Unit for each values key."),
      assumptions: z.array(z.string()),
      warnings: z.array(z.string())
    })
  });
}
function tool<N extends string, S extends z.ZodRawShape>(
  name: N,
  description: string,
  shape: S,
  calculate: (input: z.infer<z.ZodObject<S>>) => {
    values: Record<string, number>;
    units: Record<string, string>;
    assumptions?: string[];
    warnings?: string[];
  }
) {
  const inputSchema = z.object(shape).strict();
  const resultSchema = calculatorOutputSchema(name);
  return {
    name,
    description,
    inputSchema,
    execute(input: unknown) {
      const parsed = inputSchema.safeParse(input);
      if (!parsed.success)
        return {
          status: "invalid_input" as const,
          issues: [z.prettifyError(parsed.error)]
        };
      try {
        const result = calculate(parsed.data);
        return resultSchema.parse({
          status: "ok",
          result: { assumptions: [], warnings: [], ...result }
        });
      } catch (error) {
        return {
          status: "invalid_input" as const,
          issues: [
            error instanceof Error
              ? error.message
              : "Unsupported calculator input."
          ]
        };
      }
    },
    parameters: z.toJSONSchema(inputSchema, { io: "input" }),
    outputSchema: z.toJSONSchema(resultSchema)
  };
}
const alcoholUnits = { abvPercent: "%", delle: "Delle units" };
export const calculatorTools = [
  tool(
    "calculate_juice_sugar",
    "Estimate juice Brix, SG and container sugar from a nutrition label. Distinct from convert_brix_gravity: derives concentration from sugar per serving.",
    {
      sugar: volume.describe("Sugar per serving in sugarUnit."),
      sugarUnit: z.enum(["g", "mg"]).default("g"),
      servingSize: n.positive().max(1e9),
      servingUnit: z.enum(["ml", "floz"]).default("ml"),
      servings: volume.default(1)
    },
    (i) => {
      const estimate = juiceLabelEstimate(
        i.sugar,
        i.sugarUnit,
        i.servingSize,
        i.servingUnit,
        i.servings
      );
      if (i.sugar > 0 && estimate.brix === 0)
        throw new Error(
          "Label concentration exceeds the web calculator's supported range."
        );
      return {
        values: estimate,
        units: { brix: "Brix", specificGravity: "SG", totalSugar: i.sugarUnit },
        assumptions: [
          "Label concentration estimates Brix from sugar mass per serving volume; SG and Brix use web rounding. Total sugar stays in the supplied mass unit."
        ]
      };
    }
  ),
  tool(
    "calculate_abv",
    "Estimate ABV and Delle from original and fermentation final gravity, using the standalone ABV calculator (not a saved recipe).",
    { originalGravity: sg, finalGravity: sg },
    (i) => ({
      values: alcohol(i.originalGravity, i.finalGravity),
      units: alcoholUnits,
      assumptions: [
        "Final gravity is fermentation FG; Delle is an estimate, not proof of stability."
      ]
    })
  ),
  tool(
    "convert_brix_gravity",
    "Convert a gravity reading between SG and Brix using MeadTools' polynomials; not an alcohol correction.",
    { reading: n.min(0).max(100), unit: z.enum(["SG", "Brix"]) },
    (i) => {
      if (i.unit === "SG") sg.parse(i.reading);
      return {
        values: {
          specificGravity: i.unit === "SG" ? i.reading : toSG(i.reading),
          brix: i.unit === "Brix" ? i.reading : toBrix(i.reading)
        },
        units: { specificGravity: "SG", brix: "Brix" }
      };
    }
  ),
  tool(
    "estimate_original_gravity",
    "Estimate missing OG from finished hydrometer SG and refractometer Brix. Distinct from calculate_gravity_target, which plans OG from target ABV.",
    { hydrometerFg: sg, refractometerFgBrix: brix },
    (i) => {
      const originalGravity = estimatedOriginalGravity(
        i.hydrometerFg,
        i.refractometerFgBrix
      );
      return {
        values: {
          originalGravity,
          originalBrix: toBrix(originalGravity),
          ...alcohol(originalGravity, i.hydrometerFg)
        },
        units: { originalGravity: "SG", originalBrix: "Brix", ...alcoholUnits },
        assumptions: [
          "OG rounded to three decimals before derived calculations, matching the web calculator."
        ]
      };
    }
  ),
  tool(
    "calculate_sulfite",
    "Calculate standalone potassium/sodium metabisulfite grams and alternative Campden tablets from a requested ppm addition.",
    {
      volume,
      volumeUnit,
      ppm: n
        .min(0)
        .max(1000)
        .optional()
        .describe(
          "Requested ppm addition; defaults to 50 when neither ppm nor pH is supplied."
        ),
      ph: n
        .min(0)
        .max(14)
        .optional()
        .describe(
          "Alternative to ppm: select the main stabilizer calculator pH lookup, rounded to one decimal."
        ),
      type: z.enum(["kMeta", "naMeta"]).default("kMeta")
    },
    (i) => {
      if (i.ppm !== undefined && i.ph !== undefined)
        throw new Error("Specify either ppm or ph, not both.");
      const ppm = i.ph === undefined ? (i.ppm ?? 50) : sulfitePpmForPh(i.ph);
      return {
        values: {
          ...sulfiteAddition(i.volume, i.volumeUnit, ppm, i.type),
          ppm
        },
        units: { sulfiteGrams: "g", campdenTablets: "tablets", ppm: "ppm" },
        assumptions: [
          "Uses 3.785 L/US gal and 570/674 divisors, matching the web calculator.",
          "Campden tablets are an alternative to metabisulfite grams; do not add both.",
          "Requested ppm is an addition, not a measured free SO2 target."
        ]
      };
    }
  ),
  tool(
    "calculate_sorbate",
    "Calculate standalone potassium sorbate grams from ABV and batch volume. Rejects ABV above 16%, where the web formula becomes negative.",
    { volume, volumeUnit, abvPercent: n.min(0).max(16) },
    (i) => ({
      values: {
        sorbateGrams: sorbateAddition(i.volume, i.volumeUnit, i.abvPercent)
      },
      units: { sorbateGrams: "g" },
      assumptions: [
        "Sorbate and sulfite are separate additions; calculated doses do not guarantee stability."
      ]
    })
  ),
  tool(
    "correct_refractometer",
    "Correct fermented refractometer readings for alcohol; final reading must be Brix. Original gravity may be SG or Brix.",
    {
      originalReading: n.min(0).max(100),
      originalUnit: z.enum(["SG", "Brix"]).default("SG"),
      finalBrix: brix,
      correctionFactor: n.positive().max(10).default(1)
    },
    (i) => {
      if (i.originalUnit === "SG") sg.parse(i.originalReading);
      const originalGravity =
        i.originalUnit === "SG" ? i.originalReading : toSG(i.originalReading);
      const correctedGravity = refractometerCorrectedSg(
        i.originalUnit === "Brix"
          ? i.originalReading
          : toBrix(i.originalReading),
        i.finalBrix,
        i.correctionFactor
      );
      return {
        values: {
          correctedGravity,
          correctedBrix: toBrix(correctedGravity),
          ...alcohol(originalGravity, correctedGravity)
        },
        units: {
          correctedGravity: "SG",
          correctedBrix: "Brix",
          ...alcoholUnits
        },
        warnings:
          i.correctionFactor !== 1
            ? ["A non-default correction factor changes both Brix readings."]
            : []
      };
    }
  ),
  tool(
    "correct_hydrometer_temperature",
    "Correct hydrometer SG for measured and calibration temperatures; returns SG and Brix.",
    {
      specificGravity: sg,
      measuredTemperature: n,
      calibrationTemperature: n
        .optional()
        .describe(
          "Hydrometer calibration temperature; defaults to 68 F / 20 C."
        ),
      temperatureUnit
    },
    (i) => {
      const measured =
        i.temperatureUnit === "C"
          ? toFahrenheit(i.measuredTemperature)
          : i.measuredTemperature;
      const calibration =
        i.temperatureUnit === "C"
          ? toFahrenheit(i.calibrationTemperature ?? 20)
          : (i.calibrationTemperature ?? 68);
      if (
        measured < 32 ||
        measured > 212 ||
        calibration < 32 ||
        calibration > 212
      )
        throw new Error(
          "Measured and calibration temperatures must be between 32 and 212 F (0–100 C). Specify calibrationTemperature in the selected unit."
        );
      const correctedGravity = temperatureCorrection(
        i.specificGravity,
        measured,
        calibration
      );
      return {
        values: { correctedGravity, correctedBrix: toBrix(correctedGravity) },
        units: { correctedGravity: "SG", correctedBrix: "Brix" },
        assumptions: [
          "Calibration temperature uses the selected temperature unit; specify 20 for a 20 C hydrometer."
        ]
      };
    }
  ),
  tool(
    "calculate_blend",
    "Volume-weighted blend of like measurements (for example SG or ABV). Every row must use the same measurement and volume units.",
    {
      rows: z
        .array(z.object({ value: n, volume }).strict())
        .min(2)
        .max(100),
      valueUnit: z.string().min(1).max(40),
      volumeUnit: z.string().min(1).max(40)
    },
    (i) => {
      const result = blendValues(i.rows.map((row) => [row.value, row.volume]));
      if (result.totalVolume <= 0)
        throw new Error("At least one blend volume must be positive.");
      return {
        values: result,
        units: { blendedValue: i.valueUnit, totalVolume: i.volumeUnit },
        assumptions: [
          "Linear volume-weighted average; units must match across rows."
        ]
      };
    }
  ),
  tool(
    "calculate_priming_sugar",
    "Calculate priming sugar grams and standard bottle doses. Supply the chosen sugar's sugar-content percent (from search_ingredients); no catalog or saved recipe access is required.",
    {
      volume,
      volumeUnit,
      temperature: n
        .optional()
        .describe("Temperature; defaults to 68 F / 20 C."),
      temperatureUnit,
      co2Volumes: n.min(0).max(6).default(2.4),
      sugarContentPercent: n.positive().max(100).default(100)
    },
    (i) => {
      const temp =
        i.temperatureUnit === "C"
          ? toFahrenheit(i.temperature ?? 20)
          : (i.temperature ?? 68);
      if (
        temp < 32 ||
        temp > (i.temperatureUnit === "C" ? toFahrenheit(44) : 110)
      )
        throw new Error(
          "Temperature must be 32–110 F or 0–44 C, matching the web calculator."
        );
      const gallons = i.volumeUnit === "gal" ? i.volume : i.volume / 3.78541;
      const base = primingSugarBase(temp, i.co2Volumes, 1);
      if (base < 0)
        throw new Error(
          "Target carbonation is below estimated residual CO2; a negative sugar dose is unsupported."
        );
      const gramsPerGallon = (base * 100) / i.sugarContentPercent;
      const values: Record<string, number> = {
        sugarGrams: gramsPerGallon * gallons
      };
      const units: Record<string, string> = { sugarGrams: "g" };
      for (const bottle of primingBottleSizes) {
        const key = `gramsPer${bottle.label.replaceAll(" ", "")}`;
        values[key] = gallons > 0 ? gramsPerGallon * bottle.size : 0;
        units[key] = "g";
      }
      return {
        values,
        units,
        assumptions: [
          "100% sugar-content default represents table sugar. Other ingredients require their catalog sugar-content percentage.",
          "Uses 3.78541 L/US gal and the web priming bottle-size constants."
        ],
        warnings: [
          "Confirm fermentation is finished and bottles are rated for the target carbonation."
        ]
      };
    }
  ),
  tool(
    "calculate_bottling",
    "Calculate mixed bottle allocation, remaining volume, and bottles needed of each size. Sizes accept built-in labels or custom volume units. Remaining volume is negative when overallocated.",
    {
      volume,
      volumeUnit,
      rows: z
        .array(
          z
            .object({
              size: z.string().min(1).max(40),
              quantity: n.int().nonnegative().max(1e9),
              customSize: n.positive().max(1e9).optional(),
              customUnit: z.enum(["fl_oz", "ml", "liter", "gallon"]).optional()
            })
            .strict()
        )
        .min(1)
        .max(50)
    },
    (i) => {
      const target = i.volumeUnit === "gal" ? i.volume * 3.78541 : i.volume;
      const rows = i.rows.map((row) => {
        const sizeLiters =
          row.size === "custom" &&
          row.customSize !== undefined &&
          row.customUnit
            ? bottleVolumeLiters(row.customSize, row.customUnit)
            : Object.hasOwn(BOTTLE_SIZES_L, row.size)
              ? BOTTLE_SIZES_L[row.size]
              : undefined;
        if (
          !sizeLiters ||
          (row.size !== "custom" &&
            (row.customSize !== undefined || row.customUnit !== undefined))
        )
          throw new Error(
            "Use a known bottle label or size=custom with customSize and customUnit; built-in sizes cannot be overridden."
          );
        return { sizeLiters, quantity: row.quantity };
      });
      const values: Record<string, number> = bottleBreakdown(target, rows);
      const units: Record<string, string> = {
        totalBottledLiters: "L",
        remainingLiters: "L"
      };
      rows.forEach((row, index) => {
        const key = `row${index + 1}BottlesToFill`;
        values[key] = bottlesToFill(
          values.remainingLiters + row.sizeLiters * row.quantity,
          row.sizeLiters
        );
        units[key] = "bottles";
      });
      return {
        values,
        units,
        assumptions: [
          "Bottles-to-fill replaces that row's quantity, rounding up to cover remaining volume. Built-in sizes match web nominal sizes."
        ]
      };
    }
  ),
  tool(
    "calculate_bench_trial",
    "Scale a stock-solution bench trial to a batch, preserving the web calculator's intermediate rounding. Concentration is percent weight/volume; solution volume is included in the sample total.",
    {
      stockVolumeMl: volume,
      concentrationPercent: n.min(0).max(100),
      sampleMl: n.positive().max(1e9),
      batchSize: volume,
      batchUnit: z.enum(["gallon", "liter"]).default("gallon")
    },
    (i) => ({
      values: benchTrial(
        i.stockVolumeMl,
        i.concentrationPercent,
        i.sampleMl,
        i.batchSize,
        i.batchUnit
      ),
      units: {
        adjunctAmount: "g",
        adjunctConcentration: "mg/L",
        scaledAdjunct: i.batchUnit === "gallon" ? "g/US gal" : "g/L",
        scaledBatch: "g"
      },
      assumptions: [
        "Stock concentration is grams per 100 mL. Includes added stock volume; uses web intermediate rounding and 3.785 L/US gal."
      ]
    })
  )
] as const;
export type CalculatorToolName = (typeof calculatorTools)[number]["name"];
export const calculatorToolNames = calculatorTools.map((tool) => tool.name);
export const calculatorToolDefinitions = calculatorTools.map(
  ({ name, description, parameters, outputSchema }) => ({
    name,
    description,
    parameters,
    outputSchema
  })
);
export const isCalculatorTool = (name: string) =>
  calculatorToolNames.some((known) => known === name);
export function executeCalculatorTool(name: string, input: unknown) {
  return calculatorTools.find((tool) => tool.name === name)!.execute(input);
}
