import { z } from "zod";
import { recipeDerivedStateResponseBodySchema } from "@meadtools/api-contract/schemas";
import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";
import { calcABV, calcOG, toSG } from "@meadtools/core/gravity";
import { initialNutrientData } from "@meadtools/core/nutrients";
import {
  HONEY_BRIX,
  KG_TO_WEIGHT,
  L_TO_VOLUME,
  ADDITIVE_UNITS,
  VOLUME_TO_L,
  WEIGHT_TO_KG,
} from "@meadtools/core/recipe";
import {
  recipeDataV2Schema,
  type NutrientDataV2,
  type RecipeDataV2,
  type VolumeUnit,
  type WeightUnit,
} from "@meadtools/schemas";
import {
  chatbotRecipeWorkflowResultSchema,
  type ChatbotRecipeWorkflowResult,
  type WorkflowQuestion,
} from "./contracts";

const batchVolumeSchema = z.object({
  value: z.number().positive().optional(),
  unit: z.enum(["gal", "L"]).optional(),
});

const nutrientPreferencesSchema = z.object({
  enabled: z.literal(true),
  yeastBrand: z.string().min(1).optional(),
  yeastStrain: z.string().min(1).optional(),
  yeastId: z.number().int().positive().optional(),
  nitrogenRequirement: z
    .enum(["Very Low", "Low", "Medium", "High", "Very High"])
    .optional(),
  /** Authoritative catalog value carried by the host, not estimated by the model. */
  alcoholTolerance: z.number().finite().min(0).max(30).optional(),
  schedule: z
    .enum([
      "tbe",
      "tosna",
      "justK",
      "dap",
      "oAndk",
      "oAndDap",
      "kAndDap",
      "other",
    ])
    .optional(),
  numberOfAdditions: z.number().int().min(1).max(10).optional(),
  goFermType: z.enum(["Go-Ferm", "protect", "sterol-flash", "none"]).optional(),
});

const stabilizerPreferencesSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(["kmeta", "nameta"]).optional(),
  phReading: z.number().min(2).max(5).optional(),
});

const ingredientAmountSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("weight"),
    value: z.number().positive(),
    unit: z.enum(["kg", "g", "lb", "oz"]),
  }),
  z.object({
    kind: z.literal("volume"),
    value: z.number().positive(),
    unit: z.enum([
      "L",
      "mL",
      "gal",
      "qt",
      "pt",
      "fl_oz",
      "imp_gal",
      "imp_qt",
      "imp_pt",
      "imp_fl_oz",
    ]),
  }),
]);

const draftIngredientSchema = z.object({
  name: z.string().trim().min(1).max(160),
  catalogId: z.number().int().positive().optional(),
  category: z.string().trim().min(1).max(80).optional(),
  brix: z.number().min(0).max(100).optional(),
  amount: ingredientAmountSchema.optional(),
  secondary: z.boolean().optional(),
  role: z.enum(["fixed", "adjustable_fermentable", "fill_liquid"]).optional(),
});

const additiveSchema = z.object({
  name: z.string().trim().min(1).max(160),
  amount: z.number().positive().optional(),
  unit: z.enum(ADDITIVE_UNITS).optional(),
  secondary: z.boolean().optional(),
});

/** Legacy input support for drafts created before additives required a dose. */
const deferredAdditiveSchema = z.object({
  name: z.string().trim().min(1).max(160),
  secondary: z.boolean().optional(),
});

const backsweeteningSchema = z.object({
  targetFinalGravity: z.number().min(0.97).max(1.2),
  sweetener: z
    .object({
      name: z.string().trim().min(1).max(160),
      catalogId: z.number().int().positive().optional(),
      category: z.string().trim().min(1).max(80).optional(),
      brix: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

/**
 * One intake contract for any MeadTools recipe. All calculated values are
 * delegated to the shared calculation engine after this workflow creates and
 * validates a RecipeDataV2 payload.
 *
 * For a gravity-targeted recipe, mark exactly one primary fermentable as
 * `adjustable_fermentable` and omit its amount. The workflow solves that one
 * ingredient against the remaining volume. A `fill_liquid` (such as apple
 * juice) may replace water when the brewer explicitly wants it to fill.
 */
export const buildRecipeDraftInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    style: z.string().trim().min(1).max(80).optional(),
    batchVolume: batchVolumeSchema.optional(),
    /** Finished-batch ABV target; normalized to an OG by the shared workflow. */
    targetAbv: z.number().finite().min(0).max(30).optional(),
    targetOriginalGravity: z.number().min(1.001).max(1.2).optional(),
    fermentationFinalGravity: z.number().min(0.97).max(1.2).optional(),
    ingredients: z.array(draftIngredientSchema).max(30).default([]),
    additives: z.array(additiveSchema).max(20).default([]),
    deferredAdditives: z.array(deferredAdditiveSchema).max(20).default([]),
    /** The brewer wants a backsweetened finish but has not chosen its FG yet. */
    backsweeteningIntent: z.boolean().optional(),
    backsweetening: backsweeteningSchema.optional(),
    assumptions: z.array(z.string().trim().min(1).max(240)).max(10).default([]),
    allowWaterFill: z.boolean().optional(),
    nutrients: nutrientPreferencesSchema.optional(),
    stabilizers: stabilizerPreferencesSchema.optional(),
  })
  .strict();

export type BuildRecipeDraftInput = z.infer<typeof buildRecipeDraftInputSchema>;

/**
 * Produce a practical save-dialog title when the conversational model did
 * not supply one. The draft remains editable, but it should never begin as
 * an unhelpful "Untitled Recipe" just because a structured calculation has
 * no separate name field.
 */
export function defaultRecipeDraftName(input: {
  recipeDraftInput?: Pick<BuildRecipeDraftInput, "name" | "style">;
  recipeData?: RecipeDataV2;
}): string {
  const explicitName = input.recipeDraftInput?.name?.trim();
  if (explicitName) return explicitName;

  const style = input.recipeDraftInput?.style?.trim();
  if (style) return /\bmead\b/i.test(style) ? style : `${style} Mead`;

  const fruit = input.recipeData?.ingredients.find(
    (ingredient) =>
      ingredient.category.toLowerCase() === "fruit" && !ingredient.secondary,
  );
  const flavorAdditive = input.recipeData?.additives.find(
    (additive) => !/^(?:pectic enzyme|bentonite|tannin)$/i.test(additive.name),
  );
  if (fruit) {
    const fruitName = recipeNamePart(fruit.name);
    return flavorAdditive
      ? `${fruitName} ${recipeNamePart(flavorAdditive.name)} Mead`
      : `${fruitName} Mead`;
  }

  const mainIngredient = input.recipeData?.ingredients.find(
    (ingredient) =>
      !ingredient.secondary &&
      !/^(?:honey|water)$/i.test(ingredient.name.trim()) &&
      !/\(backsweetening\)$/i.test(ingredient.name.trim()),
  );
  if (mainIngredient) return `${recipeNamePart(mainIngredient.name)} Mead`;

  return "Traditional Mead";
}

function recipeNamePart(name: string): string {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (/^cocoa\s+nibs?$/i.test(normalized)) return "Chocolate";
  if (/^vanilla\s+beans?$/i.test(normalized)) return "Vanilla";
  const commaParts = normalized.split(",").map((part) => part.trim());
  return commaParts.length === 2
    ? `${commaParts[1]} ${commaParts[0]}`
    : normalized;
}

const resultBase = {
  contractVersion: 1 as const,
  operation: "build_recipe_draft" as const,
};

export function buildRecipeDraft(
  rawInput: unknown,
): ChatbotRecipeWorkflowResult {
  const parsed = buildRecipeDraftInputSchema.safeParse(rawInput);
  if (!parsed.success)
    return invalidInput(
      "Recipe intake contains invalid values.",
      parsed.error.issues,
    );

  const input = normalizeDraftInput(parsed.data);
  const fixedVolumeConflict = fixedIngredientVolumeConflict(input);
  if (fixedVolumeConflict) {
    return validateResult({
      ...resultBase,
      status: "error",
      code: "calculation_failed",
      message: fixedVolumeConflict,
    });
  }
  const questions = missingQuestions(input);
  if (questions.length > 0) {
    return validateResult({ ...resultBase, status: "needs_input", questions });
  }

  try {
    const completeInput = input as CompleteBuildRecipeDraftInput;
    const recipe = buildRecipeData(completeInput);
    const recipeValidation = recipeDataV2Schema.safeParse(recipe);
    if (!recipeValidation.success) {
      return invalidInput(
        "Generated recipe data failed the authoritative schema.",
        recipeValidation.error.issues,
      );
    }

    const calculated = calculateRecipeDerivedApiResponse(recipeValidation.data);
    const authoritative =
      recipeDerivedStateResponseBodySchema.safeParse(calculated);
    if (!authoritative.success) {
      return invalidInput(
        "Calculated recipe data failed the API response contract.",
        authoritative.error.issues,
        "calculation_failed",
      );
    }

    const warnings = ["This is an unsaved recipe draft."];
    const primaryFermentationAbv = calcABV(
      authoritative.data.derived.gravity.ogPrimary,
      completeInput.fermentationFinalGravity,
    );
    if (
      completeInput.nutrients.alcoholTolerance !== undefined &&
      primaryFermentationAbv > completeInput.nutrients.alcoholTolerance + 0.05
    ) {
      const selectedYeast = [
        completeInput.nutrients.yeastBrand,
        completeInput.nutrients.yeastStrain,
      ]
        .filter(Boolean)
        .join(" ");
      warnings.push(
        `The calculated primary fermentation is ${formatNumber(primaryFermentationAbv)}% ABV, above ${selectedYeast || "the selected yeast"}'s ${formatNumber(completeInput.nutrients.alcoholTolerance)}% catalog alcohol tolerance. MeadTools kept the stated amounts unchanged; fermenting dry to ${formatNumber(completeInput.fermentationFinalGravity)} may not be feasible without reducing the fermentable load, increasing the batch volume, or choosing a higher-tolerance yeast.`,
      );
    }
    if (
      input.targetOriginalGravity !== undefined &&
      !input.ingredients.some(
        (ingredient) =>
          ingredient.role === "adjustable_fermentable" &&
          ingredient.amount === undefined,
      ) &&
      Math.abs(
        authoritative.data.derived.gravity.ogPrimary -
          input.targetOriginalGravity,
      ) > 0.0005
    ) {
      const calculatedOg = authoritative.data.derived.gravity.ogPrimary;
      const gravityAdjustment =
        calculatedOg > input.targetOriginalGravity
          ? "reduce a fixed fermentable or increase the finished batch volume to lower the gravity"
          : "increase a fixed fermentable or reduce the finished batch volume to raise the gravity";
      warnings.push(
        `The supplied fixed fermentables calculate to an original gravity of ${formatNumber(calculatedOg)} rather than the requested ${formatNumber(input.targetOriginalGravity)}. MeadTools kept the stated amounts unchanged; ${gravityAdjustment}.`,
      );
    }

    return validateResult({
      ...resultBase,
      status: "recipe",
      recipeData: authoritative.data.recipeData,
      derived: authoritative.data.derived,
      assumptions: [
        ...input.assumptions,
        ...(input.backsweetening
          ? recipe.ingredients.some(
              (ingredient) => ingredient.lineId === "backsweetening-sweetener",
            )
            ? [
                `${input.backsweetening.sweetener?.name ?? "Honey"} was calculated as a secondary addition to reach a backsweetened final gravity of ${formatNumber(input.backsweetening.targetFinalGravity)}.`,
              ]
            : [
                `The fixed secondary additions already provide a backsweetened gravity of ${formatNumber(authoritative.data.derived.gravity.backsweetenedFg)}, which meets or exceeds the requested target of ${formatNumber(input.backsweetening.targetFinalGravity)}. No additional sweetener was calculated.`,
              ]
          : input.backsweeteningIntent && hasFixedSecondarySugar(input)
            ? [
                "Fixed secondary additions provide the backsweetening for this draft. No additional sweetener was calculated because no finished sweetness target was provided.",
              ]
            : []),
      ],
      warnings,
    });
  } catch (error) {
    return validateResult({
      ...resultBase,
      status: "error",
      code: "calculation_failed",
      message:
        error instanceof Error
          ? error.message
          : "MeadTools could not calculate the recipe draft.",
    });
  }
}

function fixedIngredientVolumeConflict(
  input: BuildRecipeDraftInput,
): string | undefined {
  if (
    !input.batchVolume?.value ||
    !input.batchVolume.unit ||
    input.ingredients.length === 0
  ) {
    return undefined;
  }
  // A role only makes an ingredient adjustable when its amount is absent. A
  // provider can incorrectly retain `fill_liquid` or
  // `adjustable_fermentable` next to a brewer-supplied amount; that amount is
  // still fixed and must be allowed to surface a real volume conflict.
  if (
    input.ingredients.some(
      (ingredient) =>
        ingredient.amount === undefined &&
        (ingredient.role === "adjustable_fermentable" ||
          ingredient.role === "fill_liquid"),
    )
  ) {
    return undefined;
  }
  try {
    const fixedVolumeL = input.ingredients.reduce(
      (total, ingredient) => total + toSuppliedIngredient(ingredient).volumeL,
      0,
    );
    const requestedVolumeL =
      input.batchVolume.value * VOLUME_TO_L[input.batchVolume.unit];
    if (fixedVolumeL < requestedVolumeL - 0.000001) return undefined;
    const names = input.ingredients
      .map((ingredient) => ingredient.name)
      .join(", ");
    const fruitMass = input.ingredients.filter(isSolidFruitMassIngredient);
    if (fruitMass.length > 0) {
      return `The stated fruit load (${fruitMass.map((ingredient) => ingredient.name).join(", ")}) contributes enough expected juice volume to fill the requested ${input.batchVolume.value} ${input.batchVolume.unit} finished batch. MeadTools treats fruit mass as fruit, not as a liquid measurement, but its juice still affects finished volume and gravity. Reduce the fruit load or choose a larger finished batch volume before calculating the remaining fermentables.`;
    }
    return `The fixed ingredient${input.ingredients.length === 1 ? "" : "s"} (${names}) already use the requested ${input.batchVolume.value} ${input.batchVolume.unit} batch volume. There is no room left to reconcile the supplied fermentables with the requested gravity target. Reduce a fixed liquid or fermentable amount, or choose a larger finished batch volume.`;
  } catch {
    // Missing catalog data is handled by the normal intake questions.
    return undefined;
  }
}

type CompleteBuildRecipeDraftInput = Omit<
  BuildRecipeDraftInput,
  | "batchVolume"
  | "fermentationFinalGravity"
  | "nutrients"
  | "stabilizers"
  | "additives"
> & {
  batchVolume: { value: number; unit: "gal" | "L" };
  fermentationFinalGravity: number;
  nutrients: NonNullable<BuildRecipeDraftInput["nutrients"]>;
  stabilizers:
    | { enabled: false }
    | (NonNullable<BuildRecipeDraftInput["stabilizers"]> & {
        enabled: true;
        type: "kmeta" | "nameta";
        phReading: number;
      });
  additives: Array<{
    name: string;
    amount: number;
    unit: string;
    secondary?: boolean;
  }>;
};

function normalizeDraftInput(
  input: BuildRecipeDraftInput,
): BuildRecipeDraftInput {
  // Recipe prompts naturally express their target as finished-batch ABV. Keep
  // that conversion in the shared workflow so an agent never has to invent or
  // hand-calculate an OG before it can build a draft. An explicitly supplied
  // OG remains authoritative for backwards compatibility and expert use.
  const withAbvTarget =
    input.targetOriginalGravity === undefined &&
    input.targetAbv !== undefined &&
    input.fermentationFinalGravity !== undefined
      ? {
          ...input,
          targetOriginalGravity: calcOG(
            input.targetAbv,
            input.fermentationFinalGravity,
          ),
        }
      : input;
  const measuredAdditives = withAbvTarget.additives.filter(
    (additive) => additive.amount !== undefined && additive.unit !== undefined,
  );
  const unresolvedAdditives = deduplicateDeferredAdditives([
    ...withAbvTarget.deferredAdditives,
    ...withAbvTarget.additives
      .filter((additive) => additive.amount === undefined || !additive.unit)
      .map((additive) => ({
        name: additive.name,
        ...(additive.secondary ? { secondary: true } : {}),
      })),
  ]).filter(
    (deferred) =>
      !measuredAdditives.some((additive) =>
        refersToSameAdditive(additive.name, deferred.name),
      ),
  );
  // Water is the implicit remaining-volume balance unless the brewer supplied
  // a concrete water amount. Models sometimes include a bare `Water` line;
  // treating it as an ingredient the brewer must quantify causes an otherwise
  // complete draft to stall on a pointless water question.
  const withoutImplicitWater = {
    ...withAbvTarget,
    additives: [
      ...measuredAdditives,
      ...unresolvedAdditives.map((additive) => ({
        name: additive.name,
        ...(additive.secondary ? { secondary: true } : {}),
      })),
    ],
    deferredAdditives: [],
    ingredients: withAbvTarget.ingredients.filter(
      (ingredient) =>
        ingredient.amount !== undefined ||
        ingredient.role === "fill_liquid" ||
        ingredient.name.trim().toLowerCase() !== "water",
    ),
  };
  const stabilizationRequested =
    withoutImplicitWater.stabilizers?.enabled === true ||
    withoutImplicitWater.backsweetening !== undefined ||
    withoutImplicitWater.backsweeteningIntent === true;
  const withStabilizerDefaults = stabilizationRequested
    ? {
        ...withoutImplicitWater,
        stabilizers: {
          ...withoutImplicitWater.stabilizers,
          enabled: true,
          type: withoutImplicitWater.stabilizers?.type ?? "kmeta",
          phReading: withoutImplicitWater.stabilizers?.phReading ?? 3.5,
        },
        assumptions:
          withoutImplicitWater.stabilizers?.type &&
          withoutImplicitWater.stabilizers.phReading !== undefined
            ? withoutImplicitWater.assumptions
            : [
                ...withoutImplicitWater.assumptions,
                "The stabilizer calculation uses potassium metabisulfite and an assumed pH of 3.5 unless you provide different values.",
              ],
      }
    : {
        ...withoutImplicitWater,
        // Stabilization is opt-in except when backsweetening requires it.
        // A missing preference should not turn an otherwise calculated draft
        // into an unnecessary intake question.
        stabilizers: withoutImplicitWater.stabilizers ?? { enabled: false },
      };
  // An adjustable fermentable only makes sense with a gravity target. Models
  // sometimes retain that role after a conversational turn even though the
  // user gave a concrete amount; treat it as fixed rather than saving a zero
  // quantity ingredient.
  const withValidRoles =
    withStabilizerDefaults.targetOriginalGravity === undefined
      ? {
          ...withStabilizerDefaults,
          ingredients: withStabilizerDefaults.ingredients.map((ingredient) =>
            ingredient.role === "adjustable_fermentable"
              ? { ...ingredient, role: "fixed" as const }
              : ingredient,
          ),
        }
      : withStabilizerDefaults;
  if (withValidRoles.targetOriginalGravity === undefined) return withValidRoles;
  if (
    withValidRoles.ingredients.some(
      (ingredient) => ingredient.role === "adjustable_fermentable",
    )
  ) {
    return withValidRoles;
  }
  const unquantifiedPrimaryHoney = withValidRoles.ingredients.filter(
    (ingredient) =>
      isHoneyIngredientName(ingredient.name) &&
      !ingredient.secondary &&
      !ingredient.amount,
  );
  if (unquantifiedPrimaryHoney.length !== 1) return withValidRoles;

  return {
    ...withValidRoles,
    ingredients: withValidRoles.ingredients.map((ingredient) =>
      ingredient === unquantifiedPrimaryHoney[0]
        ? { ...ingredient, role: "adjustable_fermentable" as const }
        : ingredient,
    ),
  };
}

/**
 * A later measured addition supersedes a placeholder from an earlier planning
 * turn. Normalize common packaging words so “Vanilla bean” can resolve a
 * previous “Vanilla” placeholder without making the match ingredient-specific.
 */
function refersToSameAdditive(left: string, right: string): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/\b(?:bean|beans|stick|sticks|pod|pods|leaf|leaves)\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function missingQuestions(input: BuildRecipeDraftInput): WorkflowQuestion[] {
  const questions: WorkflowQuestion[] = [];
  if (!input.batchVolume?.value || !input.batchVolume.unit) {
    questions.push({
      id: "batch_volume",
      field: "batchVolume",
      prompt: "What finished batch volume should this recipe target?",
      answerType: "object",
      options: ["gal", "L"],
    });
    // Ingredient rates, additive catalog doses, and all practical fruit-load
    // assumptions depend on finished volume. Ask this single foundational
    // question first rather than turning an otherwise natural conversation
    // into a long list of downstream requirements.
    return questions;
  }
  if (input.fermentationFinalGravity === undefined) {
    questions.push({
      id: "fermentation_final_gravity",
      field: "fermentationFinalGravity",
      prompt:
        "What fermentation final gravity should MeadTools calculate toward?",
      answerType: "number",
    });
  }
  if (
    input.backsweetening &&
    input.fermentationFinalGravity !== undefined &&
    input.backsweetening.targetFinalGravity <= input.fermentationFinalGravity
  ) {
    questions.push({
      id: "backsweetening_target",
      field: "backsweetening.targetFinalGravity",
      prompt:
        "The backsweetening target must be higher than the fermentation final gravity. What finished sweetness target should MeadTools use?",
      answerType: "number",
    });
  }
  if (
    input.backsweeteningIntent &&
    !input.backsweetening &&
    !hasFixedSecondarySugar(input)
  ) {
    questions.push({
      id: "backsweetening_target",
      field: "backsweetening.targetFinalGravity",
      prompt:
        "What finished gravity should MeadTools target after backsweetening?",
      answerType: "number",
    });
  }
  if (input.ingredients.length === 0) {
    questions.push({
      id: "recipe_ingredients",
      field: "ingredients",
      prompt:
        "Which fermentables and ingredient additions should the draft include, and which ones belong in primary versus secondary?",
      answerType: "object",
    });
  }

  if (
    input.targetAbv !== undefined &&
    input.targetOriginalGravity === undefined &&
    input.fermentationFinalGravity === undefined
  ) {
    questions.push({
      id: "fermentation_final_gravity",
      field: "fermentationFinalGravity",
      prompt:
        "What fermentation final gravity should MeadTools use for this ABV target?",
      answerType: "number",
    });
  }

  const honeyNeedsTarget =
    input.targetOriginalGravity === undefined &&
    input.targetAbv === undefined &&
    input.ingredients.some(
      (ingredient) =>
        isHoneyIngredientName(ingredient.name) && !ingredient.amount,
    );
  if (honeyNeedsTarget) {
    questions.push({
      id: "gravity_target",
      field: "targetOriginalGravity",
      prompt: "What ABV or target original gravity should this recipe aim for?",
      answerType: "number",
    });
  }

  for (const [index, ingredient] of input.ingredients.entries()) {
    if (ingredientBrix(ingredient) === undefined) {
      questions.push({
        id: `ingredient_${index}_brix`,
        field: `ingredients.${index}.brix`,
        prompt: `What Brix value should MeadTools use for ${ingredient.name}?`,
        answerType: "number",
      });
    }
    if (honeyNeedsTarget && isHoneyIngredientName(ingredient.name)) continue;
    if (ingredient.role === "fill_liquid") continue;
    if (
      input.targetOriginalGravity !== undefined &&
      ingredient.role === "adjustable_fermentable"
    )
      continue;
    if (!ingredient.amount) {
      const stage = ingredient.secondary ? " in secondary" : " in primary";
      questions.push({
        id: `ingredient_${index}_amount`,
        field: `ingredients.${index}.amount`,
        prompt: `What amount and unit should MeadTools use for ${ingredient.name}${stage}?`,
        answerType: "object",
      });
    }
  }

  for (const [index, additive] of input.additives.entries()) {
    if (additive.amount === undefined || !additive.unit) {
      const stage = additive.secondary ? " in secondary" : "";
      questions.push({
        id: `additive_${index}_amount`,
        field: `additives.${index}`,
        prompt: `What amount should the draft include for ${additive.name}${stage}?`,
        answerType: "object",
      });
    }
  }

  if (input.targetOriginalGravity !== undefined) {
    const adjustable = input.ingredients.filter(
      (ingredient) =>
        !ingredient.secondary && ingredient.role === "adjustable_fermentable",
    );
    const fixedPrimaryFermentables = input.ingredients.filter(
      (ingredient) =>
        !ingredient.secondary &&
        ingredient.amount !== undefined &&
        !isWaterIngredientName(ingredient.name),
    );
    // A stated honey/fruit amount is a fixed recipe constraint. The
    // calculation should show the resulting gravity (or surface a genuine
    // volume conflict), not force the brewer to choose an adjustable
    // fermentable they never offered to adjust.
    if (adjustable.length !== 1 && fixedPrimaryFermentables.length === 0) {
      questions.push({
        id: "adjustable_fermentable",
        field: "ingredients",
        prompt:
          "To solve a target OG, which single primary fermentable should MeadTools adjust while filling the remaining volume with water or your selected fill liquid?",
        answerType: "object",
      });
    }
  }

  const missingNutrientDetails = [
    !input.nutrients?.yeastBrand || !input.nutrients?.yeastStrain
      ? "yeast brand and strain"
      : undefined,
    !input.nutrients?.nitrogenRequirement ? "nitrogen requirement" : undefined,
    !input.nutrients?.schedule ? "nutrient schedule" : undefined,
    !input.nutrients?.numberOfAdditions
      ? "number of nutrient additions"
      : undefined,
    !input.nutrients?.goFermType ? "Go-Ferm type" : undefined,
  ].filter((detail): detail is string => detail !== undefined);
  if (missingNutrientDetails.length > 0) {
    questions.push({
      id: "nutrient_plan",
      field: "nutrients",
      prompt: `Nutrient planning is required. MeadTools still needs ${formatMissingDetails(missingNutrientDetails)}.`,
      answerType: "object",
    });
  }
  if (!input.stabilizers) {
    questions.push({
      id: "stabilizer_intent",
      field: "stabilizers",
      prompt: "Should this draft include stabilizer calculations?",
      answerType: "boolean",
    });
  } else if (
    input.stabilizers.enabled &&
    (!input.stabilizers.type || input.stabilizers.phReading === undefined)
  ) {
    questions.push({
      id: "stabilizer_plan",
      field: "stabilizers",
      prompt:
        "Which metabisulfite type and measured pH should the stabilizer calculation use?",
      answerType: "object",
      options: ["kmeta", "nameta"],
    });
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
  const supplied = input.ingredients.map((ingredient) =>
    toSuppliedIngredient(ingredient),
  );
  const adjustable =
    input.targetOriginalGravity === undefined
      ? undefined
      : supplied.find(
          (ingredient) =>
            !ingredient.secondary &&
            ingredient.role === "adjustable_fermentable",
        );
  const fillLiquid = supplied.find(
    (ingredient) => !ingredient.secondary && ingredient.role === "fill_liquid",
  );
  const fixed = supplied.filter(
    (ingredient) => ingredient !== adjustable && ingredient !== fillLiquid,
  );
  const ingredientLines = fixed.map((ingredient, index) =>
    ingredientLine({
      ...ingredient,
      lineId: `ingredient-${index + 1}`,
      volumeUnit,
      weightUnit,
    }),
  );
  let secondaryAlreadyMeetsBacksweeteningTarget = false;

  if (adjustable) {
    const requestedFinishedVolumeL =
      input.batchVolume.value * VOLUME_TO_L[input.batchVolume.unit];
    const fixedSecondary = fixed.filter((ingredient) => ingredient.secondary);
    const fixedSecondaryVolumeL = fixedSecondary.reduce(
      (total, ingredient) => total + ingredient.volumeL,
      0,
    );
    const fixedSecondaryGravityVolume = fixedSecondary.reduce(
      (total, ingredient) => total + ingredient.sg * ingredient.volumeL,
      0,
    );
    // Backsweetening is a calculated secondary addition. Reserve its volume
    // before solving the primary must so the requested batch volume and ABV
    // both describe the finished, backsweetened recipe.
    const fixedSecondaryBacksweetenedFg =
      backsweetenedGravityFromFixedSecondary({
        requestedFinishedVolumeL,
        fixedSecondaryVolumeL,
        fixedSecondaryGravityVolume,
        fermentationFinalGravity: input.fermentationFinalGravity,
      });
    secondaryAlreadyMeetsBacksweeteningTarget =
      input.backsweetening !== undefined &&
      fixedSecondaryVolumeL > 0 &&
      fixedSecondaryBacksweetenedFg >= input.backsweetening.targetFinalGravity;
    const desiredPrimaryVolumeL =
      input.backsweetening && !secondaryAlreadyMeetsBacksweeteningTarget
        ? solvePrimaryVolumeWithBacksweetening({
            requestedFinishedVolumeL,
            fixedSecondaryVolumeL,
            fixedSecondaryGravityVolume,
            fermentationFinalGravity: input.fermentationFinalGravity,
            targetFinalGravity: input.backsweetening.targetFinalGravity,
            sweetenerSg: backsweeteningSweetenerSg(input.backsweetening),
          })
        : requestedFinishedVolumeL - fixedSecondaryVolumeL;
    // Do this feasibility check before deriving a primary ABV. Otherwise a
    // malformed or over-large secondary volume reaches calcOG as NaN and
    // leaks a low-level calculator validation error into the chat.
    if (!Number.isFinite(desiredPrimaryVolumeL) || desiredPrimaryVolumeL <= 0) {
      throw new Error(
        "The finished batch volume is too small to accommodate the fixed secondary ingredients and a fermenting primary must. Reduce the secondary amount or choose a larger finished batch volume.",
      );
    }
    const fixedPrimary = fixed.filter((ingredient) => !ingredient.secondary);
    const fixedPrimaryVolumeL = fixedPrimary.reduce(
      (total, ingredient) => total + ingredient.volumeL,
      0,
    );
    const fixedPrimaryGravityVolume = fixedPrimary.reduce(
      (total, ingredient) => total + ingredient.sg * ingredient.volumeL,
      0,
    );
    const fillSg = fillLiquid?.sg ?? toSG(0);
    // The ABV target is calculated from the fermenting primary must. Secondary
    // fruit dilutes that alcohol after fermentation, so solve a stronger primary
    // OG when a fixed secondary volume is present.
    const targetAbv = calcABV(
      input.targetOriginalGravity!,
      input.fermentationFinalGravity,
    );
    const targetPrimaryAbv =
      (targetAbv * requestedFinishedVolumeL) / desiredPrimaryVolumeL;
    const targetPrimaryOg = calcOG(
      targetPrimaryAbv,
      input.fermentationFinalGravity,
    );
    const targetPrimaryGravityVolume = targetPrimaryOg * desiredPrimaryVolumeL;
    const adjustableVolumeL =
      (targetPrimaryGravityVolume -
        fixedPrimaryGravityVolume -
        fillSg * (desiredPrimaryVolumeL - fixedPrimaryVolumeL)) /
      (adjustable.sg - fillSg);
    const fillVolumeL =
      desiredPrimaryVolumeL - fixedPrimaryVolumeL - adjustableVolumeL;
    if (!Number.isFinite(adjustableVolumeL) || adjustableVolumeL <= 0) {
      throw new Error(
        "The fixed fermentables already exceed the requested ABV target. Reduce a fixed sugar source, increase the target ABV, or use a larger finished batch volume.",
      );
    }
    if (fillVolumeL < 0) {
      const fixedPrimaryNames = fixedPrimary
        .filter((ingredient) => ingredient.volumeL > 0)
        .map((ingredient) => ingredient.name)
        .join(", ");
      const fixedPrimaryFruit = fixedPrimary.filter(
        isSolidFruitMassSuppliedIngredient,
      );
      if (fixedPrimaryFruit.length > 0) {
        throw new Error(
          `The stated primary fruit load (${fixedPrimaryFruit.map((ingredient) => ingredient.name).join(", ")}) leaves no liquid room in the requested ${input.batchVolume.value} ${input.batchVolume.unit} finished batch for ${adjustable.name} and ${fillLiquid?.name ?? "water"} to reach the gravity target. MeadTools treats fruit mass as fruit, not as a liquid measurement, but its expected juice volume still contributes to the batch. Reduce the primary fruit load or choose a larger finished batch volume.`,
        );
      }
      throw new Error(
        `The fixed primary ingredient${fixedPrimaryNames.includes(",") ? "s" : ""} (${fixedPrimaryNames || "provided liquid"}) already use${fixedPrimaryNames.includes(",") ? "" : "s"} the requested ${input.batchVolume.value} ${input.batchVolume.unit} batch volume. There is no room left for ${adjustable.name} and ${fillLiquid?.name ?? "water"} to reach the gravity target. Reduce a fixed liquid ingredient or choose a larger batch; lowering the ABV target alone cannot resolve this volume conflict.`,
      );
    }
    ingredientLines.push(
      ingredientLine({
        ...adjustable,
        volumeL: adjustableVolumeL,
        lineId: "adjustable-fermentable",
        volumeUnit,
        weightUnit,
      }),
      ingredientLine(
        fillLiquid
          ? {
              ...fillLiquid,
              volumeL: fillVolumeL,
              lineId: "fill-liquid",
              volumeUnit,
              weightUnit,
            }
          : {
              name: "Water",
              category: "water",
              brix: 0,
              sg: fillSg,
              volumeL: fillVolumeL,
              secondary: false,
              role: "fixed",
              lineId: "water-balance",
              volumeUnit,
              weightUnit,
            },
      ),
    );
  } else {
    const desiredPrimaryVolumeL =
      input.batchVolume.value * VOLUME_TO_L[input.batchVolume.unit] -
      fixed
        .filter((ingredient) => ingredient.secondary)
        .reduce((total, ingredient) => total + ingredient.volumeL, 0);
    const fixedPrimaryVolumeL = fixed
      .filter((ingredient) => !ingredient.secondary)
      .reduce((total, ingredient) => total + ingredient.volumeL, 0);
    const fillVolumeL = desiredPrimaryVolumeL - fixedPrimaryVolumeL;
    if (fillLiquid && fillVolumeL > 0) {
      ingredientLines.push(
        ingredientLine({
          ...fillLiquid,
          volumeL: fillVolumeL,
          lineId: "fill-liquid",
          volumeUnit,
          weightUnit,
        }),
      );
    } else if (
      !fillLiquid &&
      input.allowWaterFill !== false &&
      fillVolumeL > 0
    ) {
      ingredientLines.push(
        ingredientLine({
          name: "Water",
          category: "water",
          brix: 0,
          sg: toSG(0),
          volumeL: fillVolumeL,
          secondary: false,
          role: "fixed",
          lineId: "water-balance",
          volumeUnit,
          weightUnit,
        }),
      );
    }
  }

  let recipe: RecipeDataV2 = {
    version: 2,
    unitDefaults: { weight: weightUnit, volume: volumeUnit },
    ingredients: ingredientLines,
    fg: formatNumber(input.fermentationFinalGravity),
    additives: input.additives.map((additive, index) => ({
      lineId: `additive-${index + 1}`,
      name: additive.name,
      amount: formatNumber(additive.amount),
      unit: additive.unit,
      amountTouched: true,
      amountDim: "unknown",
    })),
    stabilizers: input.stabilizers.enabled
      ? {
          adding: true,
          takingPh: true,
          phReading: formatNumber(input.stabilizers.phReading),
          type: input.stabilizers.type,
        }
      : { adding: false, takingPh: false, phReading: "", type: "kmeta" },
    notes: {
      primary: [
        {
          lineId: "recipe-workflow-note",
          content: [
            input.name
              ? `Created by the MeadTools recipe workflow: ${input.name}`
              : "Created by the MeadTools recipe workflow.",
            "",
          ] as [string, string],
        },
      ],
      secondary: [],
    },
    flags: { private: true },
  };
  recipe.nutrients = nutrientData(input);
  if (input.backsweetening && !secondaryAlreadyMeetsBacksweeteningTarget) {
    recipe = addCalculatedBacksweetening(recipe, input.backsweetening);
  }
  return recipe;
}

function deduplicateDeferredAdditives(
  additives: BuildRecipeDraftInput["deferredAdditives"],
): BuildRecipeDraftInput["deferredAdditives"] {
  const deduplicated: BuildRecipeDraftInput["deferredAdditives"] = [];
  for (const additive of additives) {
    const key = `${additive.name.trim().toLowerCase()}:${additive.secondary === true}`;
    if (
      !deduplicated.some(
        (candidate) =>
          `${candidate.name.trim().toLowerCase()}:${candidate.secondary === true}` ===
          key,
      )
    ) {
      deduplicated.push(additive);
    }
  }
  return deduplicated;
}

function addCalculatedBacksweetening(
  recipe: RecipeDataV2,
  backsweetening: NonNullable<BuildRecipeDraftInput["backsweetening"]>,
): RecipeDataV2 {
  const current = calculateRecipeDerivedApiResponse(recipe).derived;
  const target = backsweetening.targetFinalGravity;
  const fermentationFg = Number(recipe.fg);
  if (!Number.isFinite(fermentationFg) || target <= fermentationFg) {
    throw new Error(
      "The backsweetening target must be higher than the fermentation final gravity.",
    );
  }

  const primaryVolumeL = current.volume.primaryL;
  const secondaryVolumeL = current.volume.secondaryL;
  const existingSecondaryGravity =
    current.gravity.backsweetenedFg * (primaryVolumeL + secondaryVolumeL) -
    fermentationFg * primaryVolumeL;
  const sweetener = backsweetening.sweetener ?? {
    name: "Honey",
    category: "sugar",
    brix: HONEY_BRIX,
  };
  const sweetenerBrix = backsweeteningSweetenerBrix(backsweetening);
  const sweetenerSg = toSG(sweetenerBrix);
  const requiredVolumeL = calculateBacksweeteningVolumeL({
    primaryVolumeL,
    secondaryVolumeL,
    secondaryGravityVolume: existingSecondaryGravity,
    fermentationFinalGravity: fermentationFg,
    targetFinalGravity: target,
    sweetenerSg,
  });
  if (!Number.isFinite(requiredVolumeL) || requiredVolumeL <= 0) return recipe;

  const unitDefaults = recipe.unitDefaults;
  return {
    ...recipe,
    ingredients: [
      ...recipe.ingredients,
      ingredientLine({
        name: `${sweetener.name} (backsweetening)`,
        catalogId: sweetener.catalogId,
        category: sweetener.category ?? inferCategory(sweetener.name),
        brix: sweetenerBrix,
        sg: sweetenerSg,
        volumeL: requiredVolumeL,
        secondary: true,
        role: "fixed",
        lineId: "backsweetening-sweetener",
        volumeUnit: unitDefaults.volume,
        weightUnit: unitDefaults.weight,
      }),
    ],
  };
}

function backsweetenedGravityFromFixedSecondary(input: {
  requestedFinishedVolumeL: number;
  fixedSecondaryVolumeL: number;
  fixedSecondaryGravityVolume: number;
  fermentationFinalGravity: number;
}): number {
  const primaryVolumeL =
    input.requestedFinishedVolumeL - input.fixedSecondaryVolumeL;
  return (
    (input.fermentationFinalGravity * primaryVolumeL +
      input.fixedSecondaryGravityVolume) /
    input.requestedFinishedVolumeL
  );
}

function hasFixedSecondarySugar(input: BuildRecipeDraftInput): boolean {
  return input.ingredients.some((ingredient) => {
    if (!ingredient.secondary || !ingredient.amount) return false;
    const brix = ingredientBrix(ingredient);
    return brix !== undefined && brix > 0;
  });
}

function backsweeteningSweetenerBrix(
  backsweetening: NonNullable<BuildRecipeDraftInput["backsweetening"]>,
): number {
  const sweetener = backsweetening.sweetener ?? {
    name: "Honey",
    category: "sugar",
    brix: HONEY_BRIX,
  };
  const brix =
    sweetener.brix ??
    (isHoneyIngredientName(sweetener.name) ? HONEY_BRIX : undefined);
  if (brix === undefined) {
    throw new Error(
      `A Brix value is required to calculate backsweetening with ${sweetener.name}.`,
    );
  }
  return brix;
}

function backsweeteningSweetenerSg(
  backsweetening: NonNullable<BuildRecipeDraftInput["backsweetening"]>,
): number {
  return toSG(backsweeteningSweetenerBrix(backsweetening));
}

function calculateBacksweeteningVolumeL(input: {
  primaryVolumeL: number;
  secondaryVolumeL: number;
  secondaryGravityVolume: number;
  fermentationFinalGravity: number;
  targetFinalGravity: number;
  sweetenerSg: number;
}): number {
  return (
    (input.fermentationFinalGravity * input.primaryVolumeL +
      input.secondaryGravityVolume -
      input.targetFinalGravity *
        (input.primaryVolumeL + input.secondaryVolumeL)) /
    (input.targetFinalGravity - input.sweetenerSg)
  );
}

function solvePrimaryVolumeWithBacksweetening(input: {
  requestedFinishedVolumeL: number;
  fixedSecondaryVolumeL: number;
  fixedSecondaryGravityVolume: number;
  fermentationFinalGravity: number;
  targetFinalGravity: number;
  sweetenerSg: number;
}): number {
  const sweetenerVolumePerPrimaryVolume =
    (input.fermentationFinalGravity - input.targetFinalGravity) /
    (input.targetFinalGravity - input.sweetenerSg);
  const fixedSweetenerVolume =
    (input.fixedSecondaryGravityVolume -
      input.targetFinalGravity * input.fixedSecondaryVolumeL) /
    (input.targetFinalGravity - input.sweetenerSg);
  const primaryVolumeL =
    (input.requestedFinishedVolumeL -
      input.fixedSecondaryVolumeL -
      fixedSweetenerVolume) /
    (1 + sweetenerVolumePerPrimaryVolume);

  if (!Number.isFinite(primaryVolumeL) || primaryVolumeL <= 0) {
    throw new Error(
      "The finished batch volume is too small to accommodate the requested backsweetening target and fixed secondary ingredients.",
    );
  }
  return primaryVolumeL;
}

type SuppliedIngredient = {
  name: string;
  catalogId?: number;
  category: string;
  brix: number;
  sg: number;
  volumeL: number;
  requestedAmount?: BuildRecipeDraftInput["ingredients"][number]["amount"];
  secondary: boolean;
  role: "fixed" | "adjustable_fermentable" | "fill_liquid";
};

function isSolidFruitMassIngredient(
  ingredient: BuildRecipeDraftInput["ingredients"][number],
): boolean {
  return (
    ingredient.amount?.kind === "weight" &&
    /fruit/i.test(ingredient.category ?? inferCategory(ingredient.name))
  );
}

function isSolidFruitMassSuppliedIngredient(
  ingredient: SuppliedIngredient,
): boolean {
  return /fruit/i.test(ingredient.category);
}

function toSuppliedIngredient(
  ingredient: BuildRecipeDraftInput["ingredients"][number],
): SuppliedIngredient {
  const brix = ingredientBrix(ingredient);
  if (brix === undefined)
    throw new Error(`A Brix value is required for ${ingredient.name}.`);
  const sg = toSG(brix);
  // `fill_liquid` means this ingredient is intentionally left adjustable to
  // fill the remaining batch volume. A stated amount is a user constraint,
  // however, and must never be expanded or reduced just because a model also
  // marked the liquid as a fill liquid.
  const role =
    ingredient.role === "fill_liquid" && ingredient.amount
      ? "fixed"
      : (ingredient.role ?? "fixed");
  let volumeL = 0;
  if (role === "fixed") {
    if (!ingredient.amount)
      throw new Error(`An amount is required for ${ingredient.name}.`);
    volumeL =
      ingredient.amount.kind === "volume"
        ? ingredient.amount.value * VOLUME_TO_L[ingredient.amount.unit]
        : (ingredient.amount.value * WEIGHT_TO_KG[ingredient.amount.unit]) / sg;
  }
  return {
    name: ingredient.name,
    catalogId: ingredient.catalogId,
    category: ingredient.category ?? inferCategory(ingredient.name),
    brix,
    sg,
    volumeL,
    requestedAmount: ingredient.amount,
    secondary: ingredient.secondary ?? false,
    role,
  };
}

function ingredientBrix(
  ingredient: BuildRecipeDraftInput["ingredients"][number],
): number | undefined {
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

function isWaterIngredientName(name: string): boolean {
  return name.trim().toLowerCase() === "water";
}

function ingredientLine(
  input: SuppliedIngredient & {
    lineId: string;
    volumeUnit: VolumeUnit;
    weightUnit: WeightUnit;
  },
): RecipeDataV2["ingredients"][number] {
  const basis = ingredientMeasurementBasis(input);
  const weight = input.volumeL * input.sg * KG_TO_WEIGHT[input.weightUnit];
  const volume = input.volumeL * L_TO_VOLUME[input.volumeUnit];
  const requestedWeight =
    input.requestedAmount?.kind === "weight"
      ? input.requestedAmount.value *
        WEIGHT_TO_KG[input.requestedAmount.unit] *
        KG_TO_WEIGHT[input.weightUnit]
      : undefined;
  const requestedVolume =
    input.requestedAmount?.kind === "volume"
      ? input.requestedAmount.value *
        VOLUME_TO_L[input.requestedAmount.unit] *
        L_TO_VOLUME[input.volumeUnit]
      : undefined;
  return {
    lineId: input.lineId,
    name: input.name,
    ref:
      input.catalogId === undefined
        ? { kind: "custom" }
        : { kind: "catalog", ingredientId: input.catalogId },
    category: input.category,
    brix: formatNumber(input.brix),
    secondary: input.secondary,
    amounts: {
      weight: {
        value:
          basis === "weight"
            ? requestedWeight !== undefined
              ? formatNumber(requestedWeight)
              : formatPracticalIngredientAmount(weight)
            : formatNumber(weight),
        unit: input.weightUnit,
      },
      volume: {
        value:
          basis === "volume"
            ? requestedVolume !== undefined
              ? formatNumber(requestedVolume)
              : formatPracticalIngredientAmount(volume)
            : formatNumber(volume),
        unit: input.volumeUnit,
      },
      basis,
    },
  };
}

/**
 * Use the unit a brewer would normally measure for the ingredient. Fruit and
 * honey are weighed; water and other liquid fills are measured by volume.
 */
function ingredientMeasurementBasis(
  ingredient: Pick<SuppliedIngredient, "name" | "category" | "role">,
): "weight" | "volume" {
  if (ingredient.role === "fill_liquid") return "volume";
  if (isWaterIngredientName(ingredient.name)) return "volume";
  return /(?:water|juice|cider|liquid)/i.test(ingredient.category)
    ? "volume"
    : "weight";
}

function nutrientData(input: CompleteBuildRecipeDraftInput): NutrientDataV2 {
  const defaults = initialNutrientData();
  const schedule = input.nutrients.schedule!;
  return initialNutrientData({
    inputs: {
      ...defaults.inputs,
      volume: formatNumber(input.batchVolume.value),
      volumeUnits: input.batchVolume.unit === "gal" ? "gal" : "liter",
      numberOfAdditions: String(input.nutrients.numberOfAdditions),
      goFermType: input.nutrients.goFermType!,
    },
    selected: {
      ...defaults.selected,
      yeastBrand: input.nutrients.yeastBrand!,
      yeastStrain: input.nutrients.yeastStrain!,
      yeastId: input.nutrients.yeastId,
      nitrogenRequirement: input.nutrients.nitrogenRequirement!,
      schedule,
      selectedNutrients: {
        fermO: ["tbe", "tosna", "oAndk", "oAndDap"].includes(schedule),
        fermK: ["tbe", "justK", "oAndk", "kAndDap"].includes(schedule),
        dap: ["tbe", "dap", "oAndDap", "kAndDap"].includes(schedule),
        other: schedule === "other",
      },
    },
  });
}

function invalidInput(
  message: string,
  issues: Array<{ path: Array<PropertyKey>; message: string }>,
  code: "invalid_input" | "calculation_failed" = "invalid_input",
): ChatbotRecipeWorkflowResult {
  return validateResult({
    ...resultBase,
    status: "error",
    code,
    message,
    issues: issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    })),
  });
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}

/**
 * Recipe drafts are measurements a brewer needs to use, not a raw calculator
 * trace. The selected measurement is rounded to a tenth; the paired conversion
 * remains precise so MeadTools can retain its calculated gravity and volume.
 */
function formatPracticalIngredientAmount(value: number): string {
  return String(Number(value.toFixed(1)));
}

function validateResult(result: unknown): ChatbotRecipeWorkflowResult {
  return chatbotRecipeWorkflowResultSchema.parse(result);
}
