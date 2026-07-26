import { z } from "zod";
import { recipeDerivedStateResponseBodySchema } from "@meadtools/api-contract/schemas";
import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";
import { calcABV, calcOG, toSG } from "@meadtools/core/gravity";
import { initialNutrientData } from "@meadtools/core/nutrients";
import {
  HONEY_BRIX,
  KG_TO_WEIGHT,
  L_TO_VOLUME,
  VOLUME_TO_L,
  WEIGHT_TO_KG
} from "@meadtools/core/recipe";
import {
  recipeDataV2Schema,
  type NutrientDataV2,
  type RecipeDataV2,
  type VolumeUnit,
  type WeightUnit
} from "@meadtools/schemas";
import {
  chatbotRecipeWorkflowResultSchema,
  type ChatbotRecipeWorkflowResult,
  type WorkflowQuestion
} from "./contracts";

const batchVolumeSchema = z.object({
  value: z.number().positive().optional(),
  unit: z.enum(["gal", "L"]).optional()
});

const nutrientPreferencesSchema = z.object({
  enabled: z.literal(true),
  yeastBrand: z.string().min(1).optional(),
  yeastStrain: z.string().min(1).optional(),
  yeastId: z.number().int().positive().optional(),
  nitrogenRequirement: z
    .enum(["Very Low", "Low", "Medium", "High", "Very High"])
    .optional(),
  schedule: z
    .enum(["tbe", "tosna", "justK", "dap", "oAndk", "oAndDap", "kAndDap", "other"])
    .optional(),
  numberOfAdditions: z.number().int().min(1).max(10).optional(),
  goFermType: z.enum(["Go-Ferm", "protect", "sterol-flash", "none"]).optional()
});

const stabilizerPreferencesSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(["kmeta", "nameta"]).optional(),
  phReading: z.number().min(2).max(5).optional()
});

const ingredientAmountSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("weight"),
    value: z.number().positive(),
    unit: z.enum(["kg", "g", "lb", "oz"])
  }),
  z.object({
    kind: z.literal("volume"),
    value: z.number().positive(),
    unit: z.enum(["L", "mL", "gal", "qt", "pt", "fl_oz", "imp_gal", "imp_qt", "imp_pt", "imp_fl_oz"])
  })
]);

const draftIngredientSchema = z.object({
  name: z.string().trim().min(1).max(160),
  catalogId: z.number().int().positive().optional(),
  category: z.string().trim().min(1).max(80).optional(),
  brix: z.number().min(0).max(100).optional(),
  amount: ingredientAmountSchema.optional(),
  secondary: z.boolean().optional(),
  role: z.enum(["fixed", "adjustable_fermentable"]).optional()
});

const additiveSchema = z.object({
  name: z.string().trim().min(1).max(160),
  amount: z.number().positive().optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  secondary: z.boolean().optional()
});

/**
 * One intake contract for any MeadTools recipe. All calculated values are
 * delegated to the shared calculation engine after this workflow creates and
 * validates a RecipeDataV2 payload.
 *
 * For a gravity-targeted recipe, mark exactly one primary fermentable as
 * `adjustable_fermentable` and omit its amount. The workflow solves that one
 * ingredient plus water; all other ingredient amounts remain explicit.
 */
export const buildRecipeDraftInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    style: z.string().trim().min(1).max(80).optional(),
    batchVolume: batchVolumeSchema.optional(),
    targetOriginalGravity: z.number().min(1.001).max(1.2).optional(),
    fermentationFinalGravity: z.number().min(0.97).max(1.2).optional(),
    ingredients: z.array(draftIngredientSchema).max(30).default([]),
    additives: z.array(additiveSchema).max(20).default([]),
    assumptions: z.array(z.string().trim().min(1).max(240)).max(10).default([]),
    nutrients: nutrientPreferencesSchema.optional(),
    stabilizers: stabilizerPreferencesSchema.optional()
  })
  .strict();

export type BuildRecipeDraftInput = z.infer<typeof buildRecipeDraftInputSchema>;

const resultBase = {
  contractVersion: 1 as const,
  operation: "build_recipe_draft" as const
};

export function buildRecipeDraft(rawInput: unknown): ChatbotRecipeWorkflowResult {
  const parsed = buildRecipeDraftInputSchema.safeParse(rawInput);
  if (!parsed.success) return invalidInput("Recipe intake contains invalid values.", parsed.error.issues);

  const input = normalizeDraftInput(parsed.data);
  const questions = missingQuestions(input);
  if (questions.length > 0) {
    return validateResult({ ...resultBase, status: "needs_input", questions });
  }

  try {
    const recipe = buildRecipeData(input as CompleteBuildRecipeDraftInput);
    const recipeValidation = recipeDataV2Schema.safeParse(recipe);
    if (!recipeValidation.success) {
      return invalidInput("Generated recipe data failed the authoritative schema.", recipeValidation.error.issues);
    }

    const calculated = calculateRecipeDerivedApiResponse(recipeValidation.data);
    const authoritative = recipeDerivedStateResponseBodySchema.safeParse(calculated);
    if (!authoritative.success) {
      return invalidInput("Calculated recipe data failed the API response contract.", authoritative.error.issues, "calculation_failed");
    }

    const warnings = ["This is an unsaved recipe draft."];
    const targetAbv = input.targetOriginalGravity === undefined
      ? undefined
      : calcABV(input.targetOriginalGravity, input.fermentationFinalGravity!);
    if (targetAbv !== undefined && Math.abs(authoritative.data.derived.alcohol.abv - targetAbv) > 0.01) {
      warnings.push("The calculated ABV differs from the requested target; review the ingredient inputs before treating this as final.");
    }

    return validateResult({
      ...resultBase,
      status: "recipe",
      recipeData: authoritative.data.recipeData,
      derived: authoritative.data.derived,
      assumptions: [
        "Calculated values use the shared MeadTools schema and calculation engine.",
        ...input.assumptions,
        ...(input.targetOriginalGravity !== undefined
          ? ["The adjustable fermentable and water were solved against the requested ABV gravity target; all other ingredient amounts were kept explicit."]
          : ["All ingredient amounts were supplied explicitly; MeadTools calculated the resulting gravity and volume."])
      ],
      warnings
    });
  } catch (error) {
    return validateResult({
      ...resultBase,
      status: "error",
      code: "calculation_failed",
      message: error instanceof Error ? error.message : "MeadTools could not calculate the recipe draft."
    });
  }
}

type CompleteBuildRecipeDraftInput = Omit<
  BuildRecipeDraftInput,
  "batchVolume" | "fermentationFinalGravity" | "nutrients" | "stabilizers" | "additives"
> & {
  batchVolume: { value: number; unit: "gal" | "L" };
  fermentationFinalGravity: number;
  nutrients: NonNullable<BuildRecipeDraftInput["nutrients"]>;
  stabilizers: { enabled: false } | (NonNullable<BuildRecipeDraftInput["stabilizers"]> & { enabled: true; type: "kmeta" | "nameta"; phReading: number });
  additives: Array<{ name: string; amount: number; unit: string; secondary?: boolean }>;
};

function normalizeDraftInput(input: BuildRecipeDraftInput): BuildRecipeDraftInput {
  if (input.targetOriginalGravity === undefined) return input;
  if (input.ingredients.some((ingredient) => ingredient.role === "adjustable_fermentable")) {
    return input;
  }
  const unquantifiedPrimaryHoney = input.ingredients.filter(
    (ingredient) =>
      isHoneyIngredientName(ingredient.name) &&
      !ingredient.secondary &&
      !ingredient.amount
  );
  if (unquantifiedPrimaryHoney.length !== 1) return input;

  return {
    ...input,
    ingredients: input.ingredients.map((ingredient) =>
      ingredient === unquantifiedPrimaryHoney[0]
        ? { ...ingredient, role: "adjustable_fermentable" as const }
        : ingredient
    )
  };
}

function missingQuestions(input: BuildRecipeDraftInput): WorkflowQuestion[] {
  const questions: WorkflowQuestion[] = [];
  if (!input.batchVolume?.value || !input.batchVolume.unit) {
    questions.push({ id: "batch_volume", field: "batchVolume", prompt: "What finished batch volume should this recipe target?", answerType: "object", options: ["gal", "L"] });
  }
  if (input.fermentationFinalGravity === undefined) {
    questions.push({ id: "fermentation_final_gravity", field: "fermentationFinalGravity", prompt: "What fermentation final gravity should MeadTools calculate toward?", answerType: "number" });
  }
  if (input.ingredients.length === 0) {
    questions.push({ id: "recipe_ingredients", field: "ingredients", prompt: "Which fermentables and ingredient additions should the draft include, and which ones belong in primary versus secondary?", answerType: "object" });
  }

  const honeyNeedsTarget = input.targetOriginalGravity === undefined && input.ingredients.some(
    (ingredient) => isHoneyIngredientName(ingredient.name) && !ingredient.amount
  );
  if (honeyNeedsTarget) {
    questions.push({ id: "gravity_target", field: "targetOriginalGravity", prompt: "What ABV or target original gravity should this recipe aim for?", answerType: "number" });
  }

  for (const [index, ingredient] of input.ingredients.entries()) {
    if (ingredientBrix(ingredient) === undefined) {
      questions.push({ id: `ingredient_${index}_brix`, field: `ingredients.${index}.brix`, prompt: `What Brix value should MeadTools use for ${ingredient.name}?`, answerType: "number" });
    }
    if (honeyNeedsTarget && isHoneyIngredientName(ingredient.name)) continue;
    if (input.targetOriginalGravity !== undefined && ingredient.role === "adjustable_fermentable") continue;
    if (!ingredient.amount) {
      const stage = ingredient.secondary ? " in secondary" : " in primary";
      questions.push({ id: `ingredient_${index}_amount`, field: `ingredients.${index}.amount`, prompt: `What amount and unit should MeadTools use for ${ingredient.name}${stage}?`, answerType: "object" });
    }
  }

  for (const [index, additive] of input.additives.entries()) {
    if (additive.amount === undefined || !additive.unit) {
      const stage = additive.secondary ? " in secondary" : "";
      questions.push({ id: `additive_${index}_amount`, field: `additives.${index}`, prompt: `What amount should the draft include for ${additive.name}${stage}?`, answerType: "object" });
    }
  }

  if (input.targetOriginalGravity !== undefined) {
    const adjustable = input.ingredients.filter(
      (ingredient) => !ingredient.secondary && ingredient.role === "adjustable_fermentable"
    );
    if (adjustable.length !== 1) {
      questions.push({ id: "adjustable_fermentable", field: "ingredients", prompt: "To solve a target OG, which single primary fermentable should MeadTools adjust while filling the remaining volume with water?", answerType: "object" });
    }
  }

  const missingNutrientDetails = [
    !input.nutrients?.yeastBrand || !input.nutrients?.yeastStrain ? "yeast brand and strain" : undefined,
    !input.nutrients?.nitrogenRequirement ? "nitrogen requirement" : undefined,
    !input.nutrients?.schedule ? "nutrient schedule" : undefined,
    !input.nutrients?.numberOfAdditions ? "number of nutrient additions" : undefined,
    !input.nutrients?.goFermType ? "Go-Ferm type" : undefined
  ].filter((detail): detail is string => detail !== undefined);
  if (missingNutrientDetails.length > 0) {
    questions.push({ id: "nutrient_plan", field: "nutrients", prompt: `Nutrient planning is required. MeadTools still needs ${formatMissingDetails(missingNutrientDetails)}.`, answerType: "object" });
  }
  if (!input.stabilizers) {
    questions.push({ id: "stabilizer_intent", field: "stabilizers", prompt: "Should this draft include stabilizer calculations?", answerType: "boolean" });
  } else if (input.stabilizers.enabled && (!input.stabilizers.type || input.stabilizers.phReading === undefined)) {
    questions.push({ id: "stabilizer_plan", field: "stabilizers", prompt: "Which metabisulfite type and measured pH should the stabilizer calculation use?", answerType: "object", options: ["kmeta", "nameta"] });
  }
  return questions;
}

function formatMissingDetails(details: string[]): string {
  if (details.length === 1) return details[0] ?? "additional nutrient details";
  if (details.length === 2) return `${details[0]} and ${details[1]}`;
  return `${details.slice(0, -1).join(", ")}, and ${details.at(-1)}`;
}

function buildRecipeData(input: CompleteBuildRecipeDraftInput): RecipeDataV2 {
  const volumeUnit: VolumeUnit = input.batchVolume.unit;
  const weightUnit: WeightUnit = input.batchVolume.unit === "gal" ? "lb" : "kg";
  const supplied = input.ingredients.map((ingredient) => toSuppliedIngredient(ingredient));
  const adjustable = input.targetOriginalGravity === undefined
    ? undefined
    : supplied.find((ingredient) => !ingredient.secondary && ingredient.role === "adjustable_fermentable");
  const fixed = supplied.filter((ingredient) => ingredient !== adjustable);
  const ingredientLines = fixed.map((ingredient, index) => ingredientLine({ ...ingredient, lineId: `ingredient-${index + 1}`, volumeUnit, weightUnit }));

  if (adjustable) {
    const desiredPrimaryVolumeL = input.batchVolume.value * VOLUME_TO_L[input.batchVolume.unit]
      - fixed.filter((ingredient) => ingredient.secondary).reduce((total, ingredient) => total + ingredient.volumeL, 0);
    const fixedPrimary = fixed.filter((ingredient) => !ingredient.secondary);
    const fixedPrimaryVolumeL = fixedPrimary.reduce((total, ingredient) => total + ingredient.volumeL, 0);
    const fixedPrimaryGravityVolume = fixedPrimary.reduce((total, ingredient) => total + ingredient.sg * ingredient.volumeL, 0);
    const waterSg = toSG(0);
    // The ABV target is calculated from the fermenting primary must. Secondary
    // fruit dilutes that alcohol after fermentation, so solve a stronger primary
    // OG when a fixed secondary volume is present.
    const targetAbv = calcABV(input.targetOriginalGravity!, input.fermentationFinalGravity);
    const targetPrimaryAbv = targetAbv * (input.batchVolume.value * VOLUME_TO_L[input.batchVolume.unit]) / desiredPrimaryVolumeL;
    const targetPrimaryOg = calcOG(targetPrimaryAbv, input.fermentationFinalGravity);
    const targetPrimaryGravityVolume = targetPrimaryOg * desiredPrimaryVolumeL;
    const adjustableVolumeL = (
      targetPrimaryGravityVolume -
      fixedPrimaryGravityVolume -
      waterSg * (desiredPrimaryVolumeL - fixedPrimaryVolumeL)
    ) / (adjustable.sg - waterSg);
    const waterVolumeL = desiredPrimaryVolumeL - fixedPrimaryVolumeL - adjustableVolumeL;
    if (!Number.isFinite(adjustableVolumeL) || adjustableVolumeL <= 0) {
      throw new Error("The fixed fermentables already exceed the requested ABV target. Reduce a fixed sugar source, increase the target ABV, or use a larger finished batch volume.");
    }
    if (waterVolumeL < 0) {
      const fixedPrimaryNames = fixedPrimary
        .filter((ingredient) => ingredient.volumeL > 0)
        .map((ingredient) => ingredient.name)
        .join(", ");
      throw new Error(
        `The fixed primary ingredient${fixedPrimaryNames.includes(",") ? "s" : ""} (${fixedPrimaryNames || "provided liquid"}) already use${fixedPrimaryNames.includes(",") ? "" : "s"} the requested ${input.batchVolume.value} ${input.batchVolume.unit} batch volume. There is no room left for ${adjustable.name} and water to reach the gravity target. Reduce a fixed liquid ingredient or choose a larger batch; lowering the ABV target alone cannot resolve this volume conflict.`
      );
    }
    ingredientLines.push(
      ingredientLine({ ...adjustable, volumeL: adjustableVolumeL, lineId: "adjustable-fermentable", volumeUnit, weightUnit }),
      ingredientLine({ name: "Water", category: "water", brix: 0, sg: waterSg, volumeL: waterVolumeL, secondary: false, role: "fixed", lineId: "water-balance", volumeUnit, weightUnit })
    );
  }

  const recipe: RecipeDataV2 = {
    version: 2,
    unitDefaults: { weight: weightUnit, volume: volumeUnit },
    ingredients: ingredientLines,
    fg: formatNumber(input.fermentationFinalGravity),
    additives: input.additives.map((additive, index) => ({ lineId: `additive-${index + 1}`, name: additive.name, amount: formatNumber(additive.amount), unit: additive.unit, amountTouched: true, amountDim: "unknown" })),
    stabilizers: input.stabilizers.enabled
      ? { adding: true, takingPh: true, phReading: formatNumber(input.stabilizers.phReading), type: input.stabilizers.type }
      : { adding: false, takingPh: false, phReading: "", type: "kmeta" },
    notes: { primary: [{ lineId: "recipe-workflow-note", content: [input.name ? `Created by the MeadTools recipe workflow: ${input.name}` : "Created by the MeadTools recipe workflow.", ""] }], secondary: [] },
    flags: { private: true }
  };
  recipe.nutrients = nutrientData(input);
  return recipe;
}

type SuppliedIngredient = { name: string; catalogId?: number; category: string; brix: number; sg: number; volumeL: number; secondary: boolean; role: "fixed" | "adjustable_fermentable" };

function toSuppliedIngredient(ingredient: BuildRecipeDraftInput["ingredients"][number]): SuppliedIngredient {
  const brix = ingredientBrix(ingredient);
  if (brix === undefined) throw new Error(`A Brix value is required for ${ingredient.name}.`);
  const sg = toSG(brix);
  const role = ingredient.role ?? "fixed";
  let volumeL = 0;
  if (role === "fixed") {
    if (!ingredient.amount) throw new Error(`An amount is required for ${ingredient.name}.`);
    volumeL = ingredient.amount.kind === "volume"
      ? ingredient.amount.value * VOLUME_TO_L[ingredient.amount.unit]
      : (ingredient.amount.value * WEIGHT_TO_KG[ingredient.amount.unit]) / sg;
  }
  return { name: ingredient.name, catalogId: ingredient.catalogId, category: ingredient.category ?? inferCategory(ingredient.name), brix, sg, volumeL, secondary: ingredient.secondary ?? false, role };
}

function ingredientBrix(ingredient: BuildRecipeDraftInput["ingredients"][number]): number | undefined {
  if (ingredient.brix !== undefined) return ingredient.brix;
  const normalized = ingredient.name.trim().toLowerCase();
  if (normalized === "water") return 0;
  if (isHoneyIngredientName(normalized)) return HONEY_BRIX;
  return undefined;
}

function inferCategory(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (normalized === "water") return "water";
  if (isHoneyIngredientName(normalized)) return "sugar";
  return "other";
}

function isHoneyIngredientName(name: string): boolean {
  return /\bhoney\b/i.test(name);
}

function ingredientLine(input: SuppliedIngredient & { lineId: string; volumeUnit: VolumeUnit; weightUnit: WeightUnit }): RecipeDataV2["ingredients"][number] {
  return {
    lineId: input.lineId,
    name: input.name,
    ref: input.catalogId === undefined ? { kind: "custom" } : { kind: "catalog", ingredientId: input.catalogId },
    category: input.category,
    brix: formatNumber(input.brix),
    secondary: input.secondary,
    amounts: {
      weight: { value: formatNumber(input.volumeL * input.sg * KG_TO_WEIGHT[input.weightUnit]), unit: input.weightUnit },
      volume: { value: formatNumber(input.volumeL * L_TO_VOLUME[input.volumeUnit]), unit: input.volumeUnit },
      basis: "volume"
    }
  };
}

function nutrientData(input: CompleteBuildRecipeDraftInput): NutrientDataV2 {
  const defaults = initialNutrientData();
  const schedule = input.nutrients.schedule!;
  return initialNutrientData({
    inputs: { ...defaults.inputs, volume: formatNumber(input.batchVolume.value), volumeUnits: input.batchVolume.unit === "gal" ? "gal" : "liter", numberOfAdditions: String(input.nutrients.numberOfAdditions), goFermType: input.nutrients.goFermType! },
    selected: {
      ...defaults.selected,
      yeastBrand: input.nutrients.yeastBrand!, yeastStrain: input.nutrients.yeastStrain!, yeastId: input.nutrients.yeastId,
      nitrogenRequirement: input.nutrients.nitrogenRequirement!, schedule,
      selectedNutrients: {
        fermO: ["tbe", "tosna", "oAndk", "oAndDap"].includes(schedule),
        fermK: ["tbe", "justK", "oAndk", "kAndDap"].includes(schedule),
        dap: ["tbe", "dap", "oAndDap", "kAndDap"].includes(schedule),
        other: schedule === "other"
      }
    }
  });
}

function invalidInput(message: string, issues: Array<{ path: Array<PropertyKey>; message: string }>, code: "invalid_input" | "calculation_failed" = "invalid_input"): ChatbotRecipeWorkflowResult {
  return validateResult({ ...resultBase, status: "error", code, message, issues: issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message })) });
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}

function validateResult(result: unknown): ChatbotRecipeWorkflowResult {
  return chatbotRecipeWorkflowResultSchema.parse(result);
}
