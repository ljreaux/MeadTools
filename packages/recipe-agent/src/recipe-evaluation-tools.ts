import { z } from "zod";
import {
  calcABV,
  calculateEffectiveNutrientData,
  calculateNutrientDerivedState,
  calculateOriginalGravity,
  diluteRecipeAbv,
  isValidNumber,
  L_TO_VOLUME,
  parseNumber,
  recipeNutrientBasis,
  sorbateAddition,
  sulfiteAddition,
  sulfitePpmForPh,
  toSG,
} from "@meadtools/core";
import { recipeDerivedStateResponseSchema } from "@meadtools/api-contract/schemas";
import {
  ingredientLineSchema,
  nutrientDataV2Schema,
  recipeDataV2Schema,
} from "@meadtools/schemas";
import {
  calculateIngredientVolumes,
  fixedIngredientsSchema,
  ingredientVolumeInputSchema,
  liquidAmountSchema,
  liters,
  missingInputSchema,
  volumeOptions,
  volumeResultSchema,
  volumeStageSchema,
  stageSourceSchema,
  suppliedSourceSchema,
  suppliedVolumeSchema,
  type FixedIngredient,
} from "./ingredient-volumes";
import { statelessCalculator } from "./stateless-calculator";

const sg = z.number().min(0.8).max(1.6);
const abv = z.number().min(0).max(100);
const volumeClaimSchema = liquidAmountSchema.extend({
  stage: volumeStageSchema,
});
const stabilizerStageSchema = z.enum(["racked", "postAddition", "packaging"]);
const gravityReadingSchema = z.discriminatedUnion("unit", [
  z.strictObject({ value: sg, unit: z.literal("SG") }),
  z.strictObject({
    value: z.number().min(0).max(100),
    unit: z.literal("Brix"),
  }),
]);
const claimsSchema = z.strictObject({
  volumes: z.array(volumeClaimSchema).max(5).optional(),
  primaryOg: gravityReadingSchema.optional(),
  fermentationFg: sg.optional(),
  primaryAbvPercent: abv.optional(),
  finishedAbvPercent: abv.optional(),
});
const measurementsSchema = z.strictObject({
  volumes: z.array(volumeClaimSchema).max(5).optional(),
  primaryAbvPercent: abv.optional(),
  finishedAbvPercent: abv.optional(),
  primaryOg: sg.optional(),
  fermentationFg: sg.optional(),
});
const stabilizerScenarioSchema = z.strictObject({
  stage: stabilizerStageSchema,
  volume: suppliedVolumeSchema.optional(),
  abvPercent: abv.optional(),
  abvSource: suppliedSourceSchema
    .optional()
    .describe("Source of the explicit ABV. Defaults to assumption."),
  ph: z.number().min(0).max(14).optional(),
  ppm: z.number().min(0).max(1000).optional(),
  type: z.enum(["kmeta", "nameta"]).default("kmeta"),
});
const evaluationCommon = {
  ...volumeOptions,
  claims: claimsSchema.optional(),
  measurements: measurementsSchema.optional(),
  stabilizers: z.array(stabilizerScenarioSchema).max(8).optional(),
};
const recipeEvaluationInputSchema = z
  .strictObject({
    ...evaluationCommon,
    ingredients: fixedIngredientsSchema
      .optional()
      .describe(
        "Fixed quantities from an outside recipe. Supply this or recipeData.",
      ),
    nutrients: nutrientDataV2Schema.optional(),
    recipeData: recipeDataV2Schema
      .strict()
      .extend({
        ingredients: z
          .array(ingredientLineSchema.extend({ name: z.string().max(160) }))
          .max(60),
      })
      .optional()
      .describe("Inline MeadTools snapshot. Supply this or ingredients."),
  })
  .superRefine((input, ctx) => {
    if (Boolean(input.ingredients) === Boolean(input.recipeData))
      ctx.addIssue({
        code: "custom",
        message: "Supply exactly one of ingredients or recipeData.",
      });
    if (input.recipeData && input.nutrients)
      ctx.addIssue({
        code: "custom",
        path: ["nutrients"],
        message: "Use the nutrient settings in recipeData.",
      });
  });
const checkSchema = z.strictObject({
  value: z.number().nullable(),
  source: stageSourceSchema.nullable(),
  missing: z.array(missingInputSchema),
});
const comparisonSchema = z.strictObject({
  field: z.string(),
  stage: z.string(),
  unit: z.enum(["L", "SG", "%"]),
  claimed: z.number(),
  reference: z.number().nullable(),
  referenceSource: stageSourceSchema.nullable(),
  delta: z.number().nullable(),
  missing: z.array(missingInputSchema),
});
const evaluationResultSchema = z.strictObject({
  volume: volumeResultSchema,
  primaryOg: checkSchema,
  fermentationFg: checkSchema,
  primaryAbvPercent: checkSchema,
  finishedAbvPercent: checkSchema,
  nutrients: z.strictObject({
    result: recipeDerivedStateResponseSchema.shape.nutrients.nullable(),
    basis: z
      .strictObject({
        primaryVolumeL: z.number(),
        fermentedGravityPoints: z.number(),
      })
      .nullable(),
    missing: z.array(missingInputSchema),
  }),
  stabilizers: z.array(
    z.strictObject({
      stage: stabilizerStageSchema,
      volumeL: checkSchema,
      abvPercent: checkSchema,
      sulfiteBasis: z
        .strictObject({
          ph: z.number().nullable(),
          ppm: z.number(),
        })
        .nullable()
        .describe(
          "Requested sulfite addition. When pH is present, ppm came from the MeadTools pH lookup.",
        ),
      sulfiteGrams: checkSchema,
      campdenTablets: checkSchema,
      sorbateGrams: checkSchema,
    }),
  ),
  measurements: measurementsSchema.nullable(),
  claims: claimsSchema.nullable(),
  comparisons: z.array(comparisonSchema),
  assumptions: z.array(z.string()),
});

type Check = z.infer<typeof checkSchema>;
type EvaluationInput = z.infer<typeof recipeEvaluationInputSchema>;
type Comparison = z.infer<typeof comparisonSchema>;
type VolumeResult = z.infer<typeof volumeResultSchema>;

function check(
  value: number,
  source: NonNullable<Check["source"]> = "modeled",
): Check {
  return { value, source, missing: [] };
}

function unresolved(field: string, reason: string): Check {
  return { value: null, source: null, missing: [{ field, reason }] };
}

function recipeNumber(value: string) {
  if (!isValidNumber(value.trim())) return undefined;
  const number = parseNumber(value.trim());
  return Number.isFinite(number) ? number : undefined;
}

function snapshotIngredients(
  snapshot: NonNullable<EvaluationInput["recipeData"]>,
): FixedIngredient[] {
  return snapshot.ingredients.map((line) => {
    const rawBrix = recipeNumber(line.brix);
    const brix =
      rawBrix !== undefined && rawBrix >= 0 && rawBrix <= 100
        ? rawBrix
        : undefined;
    const isFruit =
      /^(fruit|dried fruit|vegetable)$/i.test(line.category.trim()) &&
      !/\bjuice\b/i.test(line.name);
    const { weight, volume, basis } = line.amounts;
    const value = recipeNumber(line.amounts[basis].value);
    const storedVolume = recipeNumber(volume.value);
    return {
      name: line.name,
      stage: line.secondary ? "secondary" : "primary",
      brix,
      kind: isFruit ? "fruit" : "liquid",
      storedVolumeL:
        storedVolume !== undefined && storedVolume >= 0
          ? liters({ value: storedVolume, unit: volume.unit })
          : undefined,
      amount:
        value === undefined || value < 0
          ? null
          : basis === "weight"
            ? { kind: "weight", value, unit: weight.unit }
            : { kind: "volume", value, unit: volume.unit },
    };
  });
}

function stageCheck(stage: VolumeResult["stages"]["racked"]): Check {
  return { value: stage.liters, source: stage.source, missing: stage.missing };
}

function compare(
  field: string,
  stage: string,
  unit: Comparison["unit"],
  claimed: number,
  reference: Check,
): Comparison {
  return {
    field,
    stage,
    unit,
    claimed,
    reference: reference.value,
    referenceSource: reference.source,
    delta: reference.value === null ? null : reference.value - claimed,
    missing: reference.missing,
  };
}

function evaluateRecipe(
  input: EvaluationInput,
): z.input<typeof evaluationResultSchema> {
  const snapshot = input.recipeData;
  const ingredients = snapshot
    ? snapshotIngredients(snapshot)
    : (input.ingredients ?? []);
  const assumptions = [
    "Primary alcohol is calculated from fermentation OG and FG. Secondary additions are modeled as alcohol-free and unfermented.",
    "Nutrients use primary liquid volume and fermented gravity points (OG minus fermentation FG), replacing the nutrient form's volume and SG.",
  ];
  const loss = snapshot?.lossAdjustment;
  const measuredRacked = input.measurements?.volumes?.find(
    ({ stage }) => stage === "racked",
  );
  const useMeasuredRacked = !input.rackedVolume && measuredRacked;
  const rackedVolume =
    input.rackedVolume ??
    (useMeasuredRacked
      ? { ...useMeasuredRacked, source: "measurement" as const }
      : undefined);
  const primaryLoss = useMeasuredRacked
    ? undefined
    : (input.primaryLoss ??
      (snapshot && !rackedVolume
        ? {
            kind: "percent" as const,
            value: loss?.enabled ? loss.percentage : 0,
          }
        : undefined));
  if (useMeasuredRacked && (input.primaryLoss || loss?.enabled)) {
    assumptions.push(
      "The measured racked volume replaces the planned primary loss for this evaluation.",
    );
  }
  if (snapshot)
    assumptions.push(
      "Native recipe stages use the stored ingredient volumes when available.",
    );
  const packagingLoss =
    input.packagingLoss ??
    (snapshot
      ? {
          kind: "percent" as const,
          value: loss?.secondary?.enabled ? loss.secondary.percentage : 0,
        }
      : undefined);
  if (
    snapshot &&
    ((!input.primaryLoss && !rackedVolume && !loss?.enabled) ||
      (!input.packagingLoss && !loss?.secondary?.enabled))
  ) {
    assumptions.push(
      "A disabled or absent loss adjustment in a native snapshot uses the recipe builder's zero-loss setting for that stage.",
    );
  }
  const volume = calculateIngredientVolumes(ingredients, {
    ...input,
    rackedVolume,
    primaryLoss,
    packagingLoss,
  });
  const rawFg = snapshot ? recipeNumber(snapshot.fg) : undefined;
  const nativeFg = sg.safeParse(rawFg);
  const claims = {
    ...(nativeFg.success ? { fermentationFg: nativeFg.data } : {}),
    ...input.claims,
  };
  const measurements = input.measurements;
  const primary = volume.ingredients.filter(
    (ingredient) => ingredient.stage === "primary",
  );
  const ogMissing = volume.ingredients.flatMap((ingredient, index) => {
    if (ingredient.stage !== "primary") return [];
    if (ingredient.liquidLiters === null) return ingredient.missing;
    if (ingredient.liquidLiters === 0 || ingredient.specificGravity !== null)
      return [];
    return [
      {
        field: `ingredients[${index}].brix`,
        reason: "Supply Brix for the primary liquid contribution.",
      },
    ];
  });
  const primaryOg = ogMissing.length
    ? { value: null, source: null, missing: ogMissing }
    : volume.stages.primary.liters
      ? check(
          calculateOriginalGravity(
            primary.flatMap((row) =>
              row.liquidLiters && row.specificGravity !== null
                ? [{ volumeL: row.liquidLiters, sg: row.specificGravity }]
                : [],
            ),
          ),
        )
      : unresolved(
          "ingredients",
          "Supply primary ingredients with a positive liquid volume.",
        );
  const ogBasis =
    measurements?.primaryOg === undefined
      ? primaryOg
      : check(measurements.primaryOg, "measurement");
  const fermentationFg =
    measurements?.fermentationFg !== undefined
      ? check(measurements.fermentationFg, "measurement")
      : claims.fermentationFg !== undefined
        ? check(claims.fermentationFg, "recipeClaim")
        : unresolved(
            "measurements.fermentationFg",
            "Supply measured fermentation FG or the recipe's planned fermentation FG. Finished sweetened gravity is a separate reading.",
          );
  let primaryAbvPercent: Check = {
    value: null,
    source: null,
    missing: [...ogBasis.missing, ...fermentationFg.missing],
  };
  if (ogBasis.value !== null && fermentationFg.value !== null) {
    const estimate = calcABV(ogBasis.value, fermentationFg.value);
    primaryAbvPercent =
      abv.safeParse(estimate).success && fermentationFg.value <= ogBasis.value
        ? check(estimate)
        : unresolved(
            "fermentationFg",
            "The OG and FG are outside the supported alcohol calculation.",
          );
  }
  const racked = volume.stages.racked;
  const finished = volume.stages.postAddition;
  const finishedAbvPercent =
    primaryAbvPercent.value !== null &&
    racked.liters !== null &&
    finished.liters
      ? check(
          diluteRecipeAbv(
            primaryAbvPercent.value,
            racked.liters,
            finished.liters,
          ),
        )
      : {
          value: null,
          source: null,
          missing: [
            ...primaryAbvPercent.missing,
            ...finished.missing,
            ...(finished.liters === 0
              ? [
                  {
                    field: "postAddition",
                    reason: "Supply a positive post-addition volume.",
                  },
                ]
              : []),
          ],
        };

  const nutrientSettings = snapshot?.nutrients ?? input.nutrients;
  const primaryLiters = volume.stages.primary.liters;
  const nutrientMissing = [
    ...primaryAbvPercent.missing,
    ...volume.stages.primary.missing,
    ...(primaryLiters === 0
      ? [
          {
            field: "ingredients",
            reason: "Supply a positive primary liquid volume.",
          },
        ]
      : []),
    ...(!nutrientSettings
      ? [
          {
            field: "nutrients",
            reason: "Supply MeadTools nutrient settings for the recipe.",
          },
        ]
      : []),
  ];
  let nutrients: z.input<typeof evaluationResultSchema>["nutrients"] = {
    result: null,
    basis: null,
    missing: [
      ...new Map(nutrientMissing.map((item) => [item.field, item])).values(),
    ],
  };
  if (
    nutrientSettings &&
    primaryLiters &&
    ogBasis.value !== null &&
    fermentationFg.value !== null &&
    primaryAbvPercent.value !== null
  ) {
    const unit = snapshot?.unitDefaults.volume === "gal" ? "gal" : "L";
    const nutrientBasis = recipeNutrientBasis({
      nutrients: nutrientSettings,
      volume: primaryLiters * L_TO_VOLUME[unit],
      volumeUnit: unit,
      og: ogBasis.value,
      fg: fermentationFg.value,
    });
    const derived = recipeDerivedStateResponseSchema.shape.nutrients.safeParse(
      calculateNutrientDerivedState(
        calculateEffectiveNutrientData(nutrientBasis),
      ),
    );
    if (derived.success) {
      nutrients = {
        result: derived.data,
        basis: {
          primaryVolumeL: primaryLiters,
          fermentedGravityPoints: (ogBasis.value - fermentationFg.value) * 1000,
        },
        missing: [],
      };
    } else {
      nutrients.missing.push({
        field: "nutrients",
        reason: "Check the numeric values in the nutrient settings.",
      });
    }
  }

  const nativePh = recipeNumber(snapshot?.stabilizers.phReading ?? "");
  const scenarios =
    input.stabilizers ??
    (snapshot?.stabilizers.adding
      ? [
          {
            stage: "postAddition" as const,
            ph:
              nativePh !== undefined && nativePh >= 0 && nativePh <= 14
                ? nativePh
                : undefined,
            type: snapshot.stabilizers.type,
          },
        ]
      : []);
  if (scenarios.length)
    assumptions.push(
      "Stabilizer calculations are stage-specific dose estimates. Zero sorbate at 16% is the formula boundary and does not establish stability.",
    );
  const stabilizers = scenarios.map(
    (scenario: z.infer<typeof stabilizerScenarioSchema>, index) => {
      if (scenario.ph !== undefined && scenario.ppm !== undefined)
        throw new Error(`stabilizers[${index}] must use either ph or ppm.`);
      if (scenario.abvSource !== undefined && scenario.abvPercent === undefined)
        throw new Error(`stabilizers[${index}].abvSource requires abvPercent.`);
      const stage = scenario.stage;
      const measuredVolume =
        stage === "racked"
          ? undefined
          : measurements?.volumes?.find((row) => row.stage === stage);
      const volumeL = scenario.volume
        ? check(liters(scenario.volume), scenario.volume.source ?? "assumption")
        : measuredVolume
          ? check(liters(measuredVolume), "measurement")
          : volume.stages[stage].liters === null
            ? unresolved(
                `volume.stages.${stage}`,
                "Resolve the missing inputs listed for this volume stage.",
              )
            : stageCheck(volume.stages[stage]);
      const measuredAbv =
        stage === "racked"
          ? measurements?.primaryAbvPercent
          : measurements?.finishedAbvPercent;
      const modeledAbv =
        stage === "racked" ? primaryAbvPercent : finishedAbvPercent;
      const abvPercent =
        scenario.abvPercent !== undefined
          ? check(scenario.abvPercent, scenario.abvSource ?? "assumption")
          : measuredAbv !== undefined
            ? check(measuredAbv, "measurement")
            : modeledAbv.value === null
              ? unresolved(
                  stage === "racked"
                    ? "primaryAbvPercent"
                    : "finishedAbvPercent",
                  "Resolve the missing inputs listed for this ABV estimate or supply the scenario ABV.",
                )
              : modeledAbv;
      const ppm =
        scenario.ppm ??
        (scenario.ph === undefined ? undefined : sulfitePpmForPh(scenario.ph));
      const sulfite =
        volumeL.value !== null && ppm !== undefined
          ? sulfiteAddition(
              volumeL.value,
              "lit",
              ppm,
              scenario.type === "kmeta" ? "kMeta" : "naMeta",
            )
          : null;
      const sulfiteMissing: Check = {
        value: null,
        source: null,
        missing: [
          ...volumeL.missing,
          ...(ppm === undefined
            ? [
                {
                  field: `stabilizers[${index}].ph`,
                  reason: "Supply pH or the requested sulfite addition in ppm.",
                },
              ]
            : []),
        ],
      };
      let sorbateGrams: Check = {
        value: null,
        source: null,
        missing: [...volumeL.missing, ...abvPercent.missing],
      };
      if (abvPercent.value !== null && abvPercent.value > 16) {
        sorbateGrams = unresolved(
          `stabilizers[${index}].abvPercent`,
          "The MeadTools sorbate formula supports ABV up to 16%.",
        );
      } else if (volumeL.value !== null && abvPercent.value !== null) {
        sorbateGrams = check(
          sorbateAddition(volumeL.value, "lit", abvPercent.value),
        );
      }
      return {
        stage,
        volumeL,
        abvPercent,
        sulfiteBasis:
          ppm === undefined ? null : { ph: scenario.ph ?? null, ppm },
        sulfiteGrams: sulfite ? check(sulfite.sulfiteGrams) : sulfiteMissing,
        campdenTablets: sulfite
          ? check(sulfite.campdenTablets)
          : sulfiteMissing,
        sorbateGrams,
      };
    },
  );

  const comparisons = (claims.volumes ?? []).map((claim) => {
    const measured = measurements?.volumes?.find(
      (row) => row.stage === claim.stage,
    );
    return compare(
      "volume",
      claim.stage,
      "L",
      liters(claim),
      measured
        ? check(liters(measured), "measurement")
        : stageCheck(volume.stages[claim.stage]),
    );
  });
  if (claims.primaryOg) {
    const claimed =
      claims.primaryOg.unit === "SG"
        ? claims.primaryOg.value
        : toSG(claims.primaryOg.value);
    comparisons.push(
      compare(
        "primaryOg",
        "primary",
        "SG",
        claimed,
        primaryOg.value === null ? ogBasis : primaryOg,
      ),
    );
  }
  if (
    claims.fermentationFg !== undefined &&
    (input.claims?.fermentationFg !== undefined ||
      measurements?.fermentationFg !== undefined)
  ) {
    const measured =
      measurements?.fermentationFg === undefined
        ? unresolved(
            "measurements.fermentationFg",
            "A measured fermentation FG is needed to check the recipe's FG claim.",
          )
        : check(measurements.fermentationFg, "measurement");
    comparisons.push(
      compare(
        "fermentationFg",
        "endOfPrimary",
        "SG",
        claims.fermentationFg,
        measured,
      ),
    );
  }
  if (claims.primaryAbvPercent !== undefined)
    comparisons.push(
      compare(
        "primaryAbvPercent",
        "endOfPrimary",
        "%",
        claims.primaryAbvPercent,
        measurements?.primaryAbvPercent === undefined
          ? primaryAbvPercent
          : check(measurements.primaryAbvPercent, "measurement"),
      ),
    );
  if (claims.finishedAbvPercent !== undefined)
    comparisons.push(
      compare(
        "finishedAbvPercent",
        "postAddition",
        "%",
        claims.finishedAbvPercent,
        measurements?.finishedAbvPercent === undefined
          ? finishedAbvPercent
          : check(measurements.finishedAbvPercent, "measurement"),
      ),
    );
  return {
    volume,
    primaryOg,
    fermentationFg,
    primaryAbvPercent,
    finishedAbvPercent,
    nutrients,
    stabilizers,
    claims: Object.keys(claims).length ? claims : null,
    measurements: measurements ?? null,
    comparisons,
    assumptions,
  };
}

type RecipeEvaluationSummaryInput =
  | (z.output<typeof volumeResultSchema> & { draftBatchVolume?: unknown })
  | z.output<typeof evaluationResultSchema>;

export function summarizeRecipeEvaluation(
  result: RecipeEvaluationSummaryInput,
) {
  const evaluation = "primaryOg" in result ? result : undefined;
  const volume = "volume" in result ? result.volume : result;
  const stages = Object.fromEntries(
    Object.entries(volume.stages).map(([stage, value]) => [
      stage,
      {
        liters: value.liters,
        knownSubtotalL: value.knownSubtotalL,
        source: value.source,
        unresolvedInputs: value.missing.length,
        examples: value.missing.slice(0, 2),
      },
    ]),
  );
  return {
    status: "ok",
    result: {
      quality: volume.quality,
      ingredientCount: volume.ingredients.length,
      unresolvedIngredients: volume.ingredients.filter(
        (row) => row.liquidLiters === null,
      ).length,
      stages,
      target: volume.target && {
        stage: volume.target.stage,
        targetL: volume.target.targetL,
        deltaL: volume.target.deltaL,
      },
      ...("draftBatchVolume" in result
        ? { draftBatchVolume: result.draftBatchVolume }
        : {}),
      ...(evaluation && {
        primaryOg: evaluation.primaryOg.value,
        fermentationFg: evaluation.fermentationFg.value,
        primaryAbvPercent: evaluation.primaryAbvPercent.value,
        finishedAbvPercent: evaluation.finishedAbvPercent.value,
        nutrients: evaluation.nutrients.result,
        stabilizers: evaluation.stabilizers.map((scenario) => ({
          stage: scenario.stage,
          volumeL: scenario.volumeL.value,
          abvPercent: scenario.abvPercent.value,
          sulfiteBasis: scenario.sulfiteBasis,
          sulfiteGrams: scenario.sulfiteGrams.value,
          campdenTablets: scenario.campdenTablets.value,
          sorbateGrams: scenario.sorbateGrams.value,
        })),
        comparisons: evaluation.comparisons.map(
          ({ missing, ...comparison }) => comparison,
        ),
      }),
    },
    details:
      "Full per-ingredient results and diagnostics are available in structuredContent.",
  };
}

export const recipeEvaluationTools = [
  statelessCalculator(
    "calculate_ingredient_volumes",
    "Calculate contributions and stage volumes for fixed ingredients. Use catalog or supplied Brix to convert weighed ingredients, including whole fruit, to modeled volume. Transfer losses apply separately. The optional draftBatchVolume is the loss-free ingredient total.",
    ingredientVolumeInputSchema,
    volumeResultSchema.extend({
      draftBatchVolume: z
        .strictObject({ value: z.number().positive(), unit: z.literal("L") })
        .nullable(),
      draftBatchVolumeNote: z.string(),
    }),
    (input) => {
      const result = calculateIngredientVolumes(input.ingredients, input);
      const { primary, secondary } = result.stages;
      const draftLiters =
        primary.liters && secondary.liters !== null
          ? primary.liters + secondary.liters
          : null;
      return {
        ...result,
        draftBatchVolume: draftLiters
          ? { value: draftLiters, unit: "L" as const }
          : null,
        draftBatchVolumeNote:
          "Pass this ingredient total as batchVolume for a loss-free draft when the solver shares the ingredient assumptions. For a draft with lossAdjustment, pass the packaged yield instead. Use allowWaterFill: false to preserve an all-fixed formulation. Both tools use Brix-based density for weighed ingredients, including fruit. An explicit density can give a different volume from the draft solver.",
      };
    },
  ),
  statelessCalculator(
    "evaluate_recipe",
    "Check an outside recipe's fixed formulation or an inline MeadTools RecipeDataV2 snapshot. Compare stage-specific volume, gravity and ABV claims, and calculate available nutrient and stabilizer scenarios. Keep amounts and their basis fixed.",
    recipeEvaluationInputSchema,
    evaluationResultSchema,
    evaluateRecipe,
  ),
] as const;
