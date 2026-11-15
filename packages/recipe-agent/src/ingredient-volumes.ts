import { z } from "zod";
import {
  HONEY_BRIX,
  isPlainWaterIngredient,
  VOLUME_TO_L,
  weightToVolumeL,
  toSG,
} from "@meadtools/core";
import { volumeAfterLoss } from "@meadtools/core/loss";
import { volumeUnitSchema, weightUnitSchema } from "@meadtools/schemas";

const amount = z.number().nonnegative().max(1e9);
export const liquidAmountSchema = z.strictObject({
  value: amount,
  unit: volumeUnitSchema,
});
export const suppliedSourceSchema = z.enum([
  "measurement",
  "assumption",
  "recipeClaim",
]);
export const stageSourceSchema = z.enum([
  "modeled",
  ...suppliedSourceSchema.options,
]);
export const suppliedVolumeSchema = liquidAmountSchema.extend({
  source: suppliedSourceSchema
    .optional()
    .describe(
      "Defaults to assumption. Mark actual measurements and recipe claims explicitly.",
    ),
});
const ingredientAmountSchema = z.discriminatedUnion("kind", [
  liquidAmountSchema.extend({ kind: z.literal("volume") }),
  z.strictObject({
    kind: z.literal("weight"),
    value: amount,
    unit: weightUnitSchema,
  }),
]);
const ingredientStageSchema = z.enum(["primary", "secondary"]);
export const volumeStageSchema = z.enum([
  "primary",
  "secondary",
  "racked",
  "postAddition",
  "packaging",
]);
export const fixedIngredientSchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  stage: ingredientStageSchema,
  amount: ingredientAmountSchema,
  kind: z
    .enum(["liquid", "fruit", "solid"])
    .optional()
    .describe(
      "Use fruit for whole, crushed or dried fruit. Fruit uses the standard ingredient density model by default. Use solid only for additions that contribute zero modeled volume and sugar. Use the density model for fermentable sugars, even when added dry.",
    ),
  brix: z.number().min(0).max(100).optional(),
  densityKgPerL: z.number().min(0.01).max(30).optional(),
  solidsDisplacement: liquidAmountSchema
    .optional()
    .describe(
      "Estimated physical displacement, reported separately from the modeled ingredient contribution.",
    ),
});
export const fixedIngredientsSchema = z
  .array(fixedIngredientSchema)
  .min(1)
  .max(60);
const lossSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("volume"), amount: liquidAmountSchema }),
  z.strictObject({
    kind: z.literal("percent"),
    value: z.number().min(0).lt(100),
  }),
]);
export const volumeOptions = {
  rackedVolume: suppliedVolumeSchema
    .optional()
    .describe(
      "Liquid volume basis after primary transfer, before secondary additions.",
    ),
  primaryLoss: lossSchema.optional(),
  packagingLoss: lossSchema
    .optional()
    .describe("Loss after secondary additions."),
  target: liquidAmountSchema.extend({ stage: volumeStageSchema }).optional(),
};
export const ingredientVolumeInputSchema = z.strictObject({
  ingredients: fixedIngredientsSchema,
  ...volumeOptions,
});
export const missingInputSchema = z.strictObject({
  field: z.string(),
  reason: z.string(),
});
const stageResultSchema = z.strictObject({
  liters: z.number().nonnegative().nullable(),
  knownSubtotalL: z.number().nonnegative(),
  source: stageSourceSchema.nullable(),
  missing: z.array(missingInputSchema),
});
const ingredientResultSchema = z.strictObject({
  name: z.string(),
  stage: ingredientStageSchema,
  amount: ingredientAmountSchema.nullable(),
  liquidLiters: z
    .number()
    .nonnegative()
    .nullable()
    .describe(
      "Modeled volume entering the recipe blend before stage losses. For weighed fruit this is the MeadTools ingredient volume.",
    ),
  solidsDisplacementL: z.number().nonnegative().nullable(),
  specificGravity: z.number().nullable(),
  missing: z.array(missingInputSchema),
  assumptions: z.array(z.string()),
});
export const volumeResultSchema = z.strictObject({
  ingredients: z.array(ingredientResultSchema),
  stages: z.record(volumeStageSchema, stageResultSchema),
  target: z
    .strictObject({
      stage: volumeStageSchema,
      targetL: z.number(),
      deltaL: z.number().nullable(),
      missing: z.array(missingInputSchema),
    })
    .nullable(),
  quality: z.enum(["complete", "partial"]),
  assumptions: z.array(z.string()),
});

type StageResult = z.infer<typeof stageResultSchema>;
type MissingInput = z.infer<typeof missingInputSchema>;
type Ingredient = z.infer<typeof fixedIngredientSchema>;
type IngredientVolumeInput = z.infer<typeof ingredientVolumeInputSchema>;
export type VolumeOptions = Omit<IngredientVolumeInput, "ingredients">;
export type FixedIngredient = Omit<Ingredient, "amount"> & {
  amount: Ingredient["amount"] | null;
  storedVolumeL?: number;
};

export function liters(amount: z.infer<typeof liquidAmountSchema>) {
  return amount.value * VOLUME_TO_L[amount.unit];
}

function resolveIngredient(ingredient: FixedIngredient, index: number) {
  const { amount, name, stage, densityKgPerL, solidsDisplacement } = ingredient;
  const field = `ingredients[${index}]`;
  const missing: MissingInput[] = [];
  const assumptions: string[] = [];
  const water = isPlainWaterIngredient(name);
  const honey =
    /\bhoney\b/i.test(name) && !/\bhoney\s+(?:wine|mead)\b/i.test(name);
  const kind = ingredient.kind ?? "liquid";
  const brix =
    ingredient.brix ??
    (kind === "liquid"
      ? water
        ? 0
        : honey
          ? HONEY_BRIX
          : undefined
      : undefined);
  if (ingredient.brix === undefined && honey && brix !== undefined)
    assumptions.push(
      "Used MeadTools standard honey Brix as a proxy for the supplied honey, including any cooking effects.",
    );
  if (honey && /\b(bochet|cooked|carameli[sz]ed|boiled)\b/i.test(name)) {
    assumptions.push(
      "Cooked honey uses the supplied or standard Brix as a proxy. MeadTools applies no cooking-specific fermentability correction.",
    );
  }
  const specificGravity = brix === undefined ? null : toSG(brix);
  let liquidLiters: number | null = null;

  const drySugar =
    /^(?:(?:table|granulated|white|cane|beet|brown|corn|powdered|raw) )*sugar$|^(?:dextrose|sucrose|glucose|fructose)$/i.test(
      name,
    );
  if (
    kind === "solid" &&
    amount?.value &&
    (drySugar || (ingredient.brix ?? 0) > 0)
  ) {
    throw new Error(
      `${field}.kind: A fermentable contributes to the recipe blend. Use the density model with Brix or density for a weighed sugar.`,
    );
  }

  if (ingredient.storedVolumeL !== undefined) {
    liquidLiters = ingredient.storedVolumeL;
  } else if (!amount) {
    missing.push({
      field: `${field}.amount`,
      reason: "Supply a numeric amount in the ingredient's quantity basis.",
    });
  } else if (amount.value === 0 || kind === "solid") {
    liquidLiters = 0;
  } else if (amount.kind === "volume") {
    liquidLiters = liters(amount);
  } else {
    const density = densityKgPerL ?? specificGravity;
    if (density === null) {
      missing.push({
        field: `${field}.densityKgPerL`,
        reason:
          "Supply density in kg/L or Brix for the MeadTools density estimate.",
      });
    } else {
      liquidLiters = weightToVolumeL(amount.value, amount.unit, density);
      if (densityKgPerL === undefined)
        assumptions.push(
          "Used Brix-derived specific gravity as estimated density in kg/L.",
        );
    }
  }
  return {
    name,
    stage,
    amount,
    liquidLiters,
    specificGravity,
    missing,
    assumptions,
    solidsDisplacementL: solidsDisplacement ? liters(solidsDisplacement) : null,
  };
}

function stageResult(
  knownSubtotalL: number,
  missing: MissingInput[],
  source: NonNullable<StageResult["source"]> = "modeled",
): StageResult {
  return {
    liters: missing.length ? null : knownSubtotalL,
    knownSubtotalL,
    missing,
    source: missing.length ? null : source,
  };
}

function subtractLoss(
  basis: StageResult,
  loss: VolumeOptions["primaryLoss"],
  field: "primaryLoss" | "packagingLoss",
  reason: string,
): StageResult {
  if (!loss)
    return stageResult(basis.knownSubtotalL, [
      ...basis.missing,
      { field, reason },
    ]);
  const lossValue =
    loss.kind === "percent"
      ? { percentage: loss.value }
      : { liters: liters(loss.amount) };
  const { remainingL } = volumeAfterLoss(basis.knownSubtotalL, lossValue);
  if (basis.liters !== null && remainingL < 0)
    return stageResult(0, [
      { field, reason: "Loss exceeds the liquid available at this stage." },
    ]);
  return stageResult(Math.max(0, remainingL), basis.missing);
}

export function calculateIngredientVolumes(
  ingredients: FixedIngredient[],
  options: VolumeOptions,
) {
  if (options.rackedVolume && options.primaryLoss)
    throw new Error(
      "Supply rackedVolume or primaryLoss for the primary transfer.",
    );
  const rows = ingredients.map(resolveIngredient);
  const sumStage = (stage: Ingredient["stage"]) => {
    const staged = rows.filter((row) => row.stage === stage);
    return stageResult(
      staged.reduce((sum, row) => sum + (row.liquidLiters ?? 0), 0),
      staged.flatMap((row) => row.missing),
    );
  };
  const primary = sumStage("primary");
  const secondary = sumStage("secondary");
  const hasPrimary = rows.some((row) => row.stage === "primary");
  const racked = options.rackedVolume
    ? stageResult(
        liters(options.rackedVolume),
        [],
        options.rackedVolume.source ?? "assumption",
      )
    : hasPrimary
      ? subtractLoss(
          primary,
          options.primaryLoss,
          "primaryLoss",
          "Supply the primary transfer loss, including zero, or measure the racked volume.",
        )
      : stageResult(0, [
          {
            field: "rackedVolume",
            reason:
              "Supply the racked volume or the primary ingredients and their transfer loss.",
          },
        ]);
  const postAddition = stageResult(
    racked.knownSubtotalL + secondary.knownSubtotalL,
    [...racked.missing, ...secondary.missing],
  );
  const packaging = subtractLoss(
    postAddition,
    options.packagingLoss,
    "packagingLoss",
    "Supply the loss between post-addition and packaging, including zero.",
  );
  const stages = { primary, secondary, racked, postAddition, packaging };
  const target = options.target;
  const targetL = target ? liters(target) : 0;
  const targetStage = target ? stages[target.stage] : null;
  return {
    ingredients: rows,
    stages,
    target:
      target && targetStage
        ? {
            stage: target.stage,
            targetL,
            deltaL:
              targetStage.liters === null ? null : targetStage.liters - targetL,
            missing: targetStage.missing,
          }
        : null,
    quality: Object.values(stages).some((stage) => stage.liters === null)
      ? ("partial" as const)
      : ("complete" as const),
    assumptions: [
      "Stage totals use modeled ingredient volumes, then apply transfer losses separately. Physical solids displacement is reported separately.",
      "While a stage is unresolved, its subtotal reflects the known inputs and any supplied loss.",
    ],
  };
}
