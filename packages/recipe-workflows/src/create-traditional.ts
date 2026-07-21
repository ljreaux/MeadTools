import { z } from "zod";
import { recipeDerivedStateResponseBodySchema } from "@meadtools/api-contract/schemas";
import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";
import { toSG } from "@meadtools/core/gravity";
import { initialNutrientData } from "@meadtools/core/nutrients";
import {
  HONEY_BRIX,
  KG_TO_WEIGHT,
  L_TO_VOLUME,
  VOLUME_TO_L,
  calculateHoneyAndWaterL
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
  enabled: z.boolean(),
  yeastBrand: z.string().min(1).optional(),
  yeastStrain: z.string().min(1).optional(),
  yeastId: z.number().int().positive().optional(),
  nitrogenRequirement: z
    .enum(["Very Low", "Low", "Medium", "High", "Very High"])
    .optional(),
  schedule: z
    .enum([
      "tbe",
      "tosna",
      "justK",
      "dap",
      "oAndk",
      "oAndDap",
      "kAndDap",
      "other"
    ])
    .optional(),
  numberOfAdditions: z.number().int().min(1).max(10).optional(),
  goFermType: z
    .enum(["Go-Ferm", "protect", "sterol-flash", "none"])
    .optional()
});

const stabilizerPreferencesSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(["kmeta", "nameta"]).optional(),
  phReading: z.number().min(2).max(5).optional()
});

export const traditionalMeadInputSchema = z
  .object({
    batchVolume: batchVolumeSchema.optional(),
    targetOriginalGravity: z.number().min(1.001).max(1.2).optional(),
    fermentationFinalGravity: z.number().min(0.97).max(1.2).optional(),
    nutrients: nutrientPreferencesSchema.optional(),
    stabilizers: stabilizerPreferencesSchema.optional()
  })
  .strict();

export type TraditionalMeadInput = z.infer<typeof traditionalMeadInputSchema>;

const resultBase = {
  contractVersion: 1 as const,
  operation: "create_traditional" as const
};

export function createTraditionalMead(
  rawInput: unknown
): ChatbotRecipeWorkflowResult {
  const parsedInput = traditionalMeadInputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return validateResult({
      ...resultBase,
      status: "error",
      code: "invalid_input",
      message: "Traditional mead intake contains invalid values.",
      issues: parsedInput.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  const input = parsedInput.data;
  const questions = missingQuestions(input);
  if (questions.length > 0) {
    return validateResult({
      ...resultBase,
      status: "needs_input",
      questions
    });
  }

  const completeInput = input as CompleteTraditionalMeadInput;
  if (
    completeInput.fermentationFinalGravity >=
    completeInput.targetOriginalGravity
  ) {
    return validateResult({
      ...resultBase,
      status: "error",
      code: "invalid_input",
      message:
        "Fermentation final gravity must be lower than original gravity for this workflow."
    });
  }

  try {
    const candidate = buildRecipeData(completeInput);
    const recipeValidation = recipeDataV2Schema.safeParse(candidate);
    if (!recipeValidation.success) {
      return validateResult({
        ...resultBase,
        status: "error",
        code: "invalid_recipe",
        message: "Generated recipe data failed the authoritative schema.",
        issues: recipeValidation.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    const calculated = calculateRecipeDerivedApiResponse(
      recipeValidation.data
    );
    const authoritativeResult =
      recipeDerivedStateResponseBodySchema.safeParse(calculated);
    if (!authoritativeResult.success) {
      return validateResult({
        ...resultBase,
        status: "error",
        code: "calculation_failed",
        message: "Calculated recipe data failed the API response contract.",
        issues: authoritativeResult.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return validateResult({
      ...resultBase,
      status: "recipe",
      recipeData: authoritativeResult.data.recipeData,
      derived: authoritativeResult.data.derived,
      assumptions: [
        "Used water at 0 Brix and honey at the MeadTools standard 79.6 Brix.",
        "The draft uses custom ingredient references until catalog selection is added to the hosted agent."
      ],
      warnings: ["This is an unsaved recipe draft."]
    });
  } catch (error) {
    return validateResult({
      ...resultBase,
      status: "error",
      code: "calculation_failed",
      message:
        error instanceof Error
          ? error.message
          : "MeadTools could not calculate the recipe draft."
    });
  }
}

type CompleteTraditionalMeadInput = TraditionalMeadInput & {
  batchVolume: { value: number; unit: "gal" | "L" };
  targetOriginalGravity: number;
  fermentationFinalGravity: number;
  nutrients:
    | { enabled: false }
    | (Required<
        Pick<
          NonNullable<TraditionalMeadInput["nutrients"]>,
          | "enabled"
          | "yeastBrand"
          | "yeastStrain"
          | "nitrogenRequirement"
          | "schedule"
          | "numberOfAdditions"
          | "goFermType"
        >
      > & { enabled: true; yeastId?: number });
  stabilizers:
    | { enabled: false }
    | {
        enabled: true;
        type: "kmeta" | "nameta";
        phReading: number;
      };
};

function missingQuestions(input: TraditionalMeadInput): WorkflowQuestion[] {
  const questions: WorkflowQuestion[] = [];

  if (!input.batchVolume?.value || !input.batchVolume.unit) {
    questions.push({
      id: "batch_volume",
      field: "batchVolume",
      prompt: "What finished batch volume should this recipe target?",
      answerType: "object",
      options: ["gal", "L"]
    });
  }
  if (input.targetOriginalGravity === undefined) {
    questions.push({
      id: "target_original_gravity",
      field: "targetOriginalGravity",
      prompt: "What original gravity should the traditional mead target?",
      answerType: "number"
    });
  }
  if (input.fermentationFinalGravity === undefined) {
    questions.push({
      id: "fermentation_final_gravity",
      field: "fermentationFinalGravity",
      prompt: "What fermentation final gravity should MeadTools calculate toward?",
      answerType: "number"
    });
  }
  if (!input.nutrients) {
    questions.push({
      id: "nutrient_intent",
      field: "nutrients",
      prompt: "Should this draft include a nutrient plan?",
      answerType: "boolean"
    });
  } else if (
    input.nutrients.enabled &&
    (!input.nutrients.yeastBrand ||
      !input.nutrients.yeastStrain ||
      !input.nutrients.nitrogenRequirement ||
      !input.nutrients.schedule ||
      !input.nutrients.numberOfAdditions ||
      !input.nutrients.goFermType)
  ) {
    questions.push({
      id: "nutrient_plan",
      field: "nutrients",
      prompt:
        "Which yeast, nitrogen requirement, schedule, addition count, and Go-Ferm type should the nutrient calculation use?",
      answerType: "object"
    });
  }
  if (!input.stabilizers) {
    questions.push({
      id: "stabilizer_intent",
      field: "stabilizers",
      prompt: "Should this draft include stabilizer calculations?",
      answerType: "boolean"
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
      options: ["kmeta", "nameta"]
    });
  }

  return questions;
}

function buildRecipeData(input: CompleteTraditionalMeadInput): RecipeDataV2 {
  const volumeUnit: VolumeUnit = input.batchVolume.unit;
  const weightUnit: WeightUnit =
    input.batchVolume.unit === "gal" ? "lb" : "kg";
  const totalVolumeL =
    input.batchVolume.value * VOLUME_TO_L[input.batchVolume.unit];
  const { honeyL, waterL } = calculateHoneyAndWaterL(
    input.targetOriginalGravity,
    totalVolumeL
  );
  const honeySg = toSG(HONEY_BRIX);
  const waterSg = toSG(0);

  const recipe: RecipeDataV2 = {
    version: 2,
    unitDefaults: { weight: weightUnit, volume: volumeUnit },
    ingredients: [
      ingredientLine({
        lineId: "traditional-water",
        name: "Water",
        category: "water",
        brix: 0,
        volumeL: waterL,
        sg: waterSg,
        volumeUnit,
        weightUnit
      }),
      ingredientLine({
        lineId: "traditional-honey",
        name: "Honey",
        category: "sugar",
        brix: HONEY_BRIX,
        volumeL: honeyL,
        sg: honeySg,
        volumeUnit,
        weightUnit
      })
    ],
    fg: formatNumber(input.fermentationFinalGravity),
    additives: [],
    stabilizers: input.stabilizers.enabled
      ? {
          adding: true,
          takingPh: true,
          phReading: formatNumber(input.stabilizers.phReading),
          type: input.stabilizers.type
        }
      : {
          adding: false,
          takingPh: false,
          phReading: "",
          type: "kmeta"
        },
    notes: {
      primary: [
        {
          lineId: "traditional-workflow-note",
          content: ["Created by the MeadTools recipe workflow.", ""]
        }
      ],
      secondary: []
    },
    flags: { private: true }
  };

  if (input.nutrients.enabled) {
    recipe.nutrients = nutrientData(input);
  }

  return recipe;
}

function ingredientLine(input: {
  lineId: string;
  name: string;
  category: string;
  brix: number;
  volumeL: number;
  sg: number;
  volumeUnit: VolumeUnit;
  weightUnit: WeightUnit;
}): RecipeDataV2["ingredients"][number] {
  return {
    lineId: input.lineId,
    name: input.name,
    ref: { kind: "custom" },
    category: input.category,
    brix: formatNumber(input.brix),
    secondary: false,
    amounts: {
      weight: {
        value: formatNumber(
          input.volumeL * input.sg * KG_TO_WEIGHT[input.weightUnit]
        ),
        unit: input.weightUnit
      },
      volume: {
        value: formatNumber(
          input.volumeL * L_TO_VOLUME[input.volumeUnit]
        ),
        unit: input.volumeUnit
      },
      basis: "volume"
    }
  };
}

function nutrientData(input: CompleteTraditionalMeadInput): NutrientDataV2 {
  if (!input.nutrients.enabled) {
    throw new Error("Nutrient data requested for a disabled nutrient plan.");
  }

  const defaults = initialNutrientData();
  const selectedNutrients = nutrientSelection(input.nutrients.schedule);
  return initialNutrientData({
    inputs: {
      ...defaults.inputs,
      volume: formatNumber(input.batchVolume.value),
      volumeUnits: input.batchVolume.unit === "gal" ? "gal" : "liter",
      numberOfAdditions: String(input.nutrients.numberOfAdditions),
      goFermType: input.nutrients.goFermType
    },
    selected: {
      ...defaults.selected,
      yeastBrand: input.nutrients.yeastBrand,
      yeastStrain: input.nutrients.yeastStrain,
      yeastId: input.nutrients.yeastId,
      nitrogenRequirement: input.nutrients.nitrogenRequirement,
      schedule: input.nutrients.schedule,
      selectedNutrients
    }
  });
}

function nutrientSelection(
  schedule: NutrientDataV2["selected"]["schedule"]
): NutrientDataV2["selected"]["selectedNutrients"] {
  return {
    fermO: ["tbe", "tosna", "oAndk", "oAndDap"].includes(schedule),
    fermK: ["tbe", "justK", "oAndk", "kAndDap"].includes(schedule),
    dap: ["tbe", "dap", "oAndDap", "kAndDap"].includes(schedule),
    other: schedule === "other"
  };
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}

function validateResult(result: unknown): ChatbotRecipeWorkflowResult {
  return chatbotRecipeWorkflowResultSchema.parse(result);
}
