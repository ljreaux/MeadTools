import { z } from "zod";
import { recipeDerivedStateResponseBodySchema } from "@meadtools/api-contract/schemas";
import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";
import { toSG } from "@meadtools/core/gravity";
import {
  HONEY_BRIX,
  KG_TO_WEIGHT,
  L_TO_VOLUME,
  calculateHoneyAndWaterL,
} from "@meadtools/core/recipe";
import { recipeDataV2Schema, type RecipeDataV2 } from "@meadtools/schemas";
import {
  chatbotRecipeWorkflowResultSchema,
  type ChatbotRecipeWorkflowResult,
  type WorkflowQuestion,
} from "./contracts";

const traditionalWaterLineId = "traditional-water";
const traditionalHoneyLineId = "traditional-honey";

export const refineTraditionalMeadInputSchema = z
  .object({
    activeRecipeData: recipeDataV2Schema,
    targetOriginalGravity: z.number().min(1.001).max(1.2).optional(),
    fermentationFinalGravity: z.number().min(0.97).max(1.2).optional(),
  })
  .strict();

export type RefineTraditionalMeadInput = z.infer<
  typeof refineTraditionalMeadInputSchema
>;

const resultBase = {
  contractVersion: 1 as const,
  operation: "refine_traditional" as const,
};

/**
 * Refine a traditional draft created by this package. Targets must be explicit:
 * interpreting phrases such as "a little stronger" belongs to the hosted agent.
 */
export function refineTraditionalMead(
  rawInput: unknown,
): ChatbotRecipeWorkflowResult {
  const parsedInput = refineTraditionalMeadInputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return invalidInput(
      parsedInput.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  const input = parsedInput.data;
  if (
    input.targetOriginalGravity === undefined &&
    input.fermentationFinalGravity === undefined
  ) {
    return validateResult({
      ...resultBase,
      status: "needs_input",
      questions: missingQuestions(),
    });
  }

  const waterLine = input.activeRecipeData.ingredients.find(
    (line) => line.lineId === traditionalWaterLineId,
  );
  const honeyLine = input.activeRecipeData.ingredients.find(
    (line) => line.lineId === traditionalHoneyLineId,
  );
  if (
    !waterLine ||
    !honeyLine ||
    input.activeRecipeData.ingredients.length !== 2
  ) {
    return invalidInput([
      {
        path: "activeRecipeData.ingredients",
        message:
          "Traditional refinement requires the water and honey lines created by the traditional workflow.",
      },
    ]);
  }

  const current = calculateRecipeDerivedApiResponse(input.activeRecipeData);
  const targetOriginalGravity =
    input.targetOriginalGravity ?? current.derived.gravity.ogPrimary;
  const fermentationFinalGravity =
    input.fermentationFinalGravity ?? Number(input.activeRecipeData.fg);

  if (fermentationFinalGravity >= targetOriginalGravity) {
    return invalidInput([
      {
        path: "fermentationFinalGravity",
        message:
          "Fermentation final gravity must be lower than original gravity for this workflow.",
      },
    ]);
  }

  try {
    const { honeyL, waterL } = calculateHoneyAndWaterL(
      targetOriginalGravity,
      current.derived.volume.totalL,
    );
    const refined = recipeDataV2Schema.parse({
      ...input.activeRecipeData,
      fg: formatNumber(fermentationFinalGravity),
      ingredients: input.activeRecipeData.ingredients.map((line) => {
        if (line.lineId === traditionalWaterLineId) {
          return replaceAmounts(input.activeRecipeData, line, waterL, toSG(0));
        }
        if (line.lineId === traditionalHoneyLineId) {
          return replaceAmounts(
            input.activeRecipeData,
            line,
            honeyL,
            toSG(HONEY_BRIX),
          );
        }
        return line;
      }),
    });
    const calculated = calculateRecipeDerivedApiResponse(refined);
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
          message: issue.message,
        })),
      });
    }

    return validateResult({
      ...resultBase,
      status: "recipe",
      recipeData: authoritativeResult.data.recipeData,
      derived: authoritativeResult.data.derived,
      assumptions: [
        "Kept the active draft's total volume and all non-honey/water recipe fields.",
        "Recalculated traditional honey and water amounts with the MeadTools calculation engine.",
      ],
      warnings: ["This is an unsaved recipe draft."],
    });
  } catch (error) {
    return validateResult({
      ...resultBase,
      status: "error",
      code: "calculation_failed",
      message:
        error instanceof Error
          ? error.message
          : "MeadTools could not refine the recipe draft.",
    });
  }
}

function missingQuestions(): WorkflowQuestion[] {
  return [
    {
      id: "refinement_target",
      field: "targetOriginalGravity",
      prompt:
        "What explicit original gravity or fermentation final gravity should this traditional draft target?",
      answerType: "number",
    },
  ];
}

function replaceAmounts(
  recipeData: RecipeDataV2,
  line: RecipeDataV2["ingredients"][number],
  volumeL: number,
  sg: number,
): RecipeDataV2["ingredients"][number] {
  const volumeUnit = recipeData.unitDefaults.volume;
  const weightUnit = recipeData.unitDefaults.weight;
  return {
    ...line,
    amounts: {
      weight: {
        value: formatNumber(volumeL * sg * KG_TO_WEIGHT[weightUnit]),
        unit: weightUnit,
      },
      volume: {
        value: formatNumber(volumeL * L_TO_VOLUME[volumeUnit]),
        unit: volumeUnit,
      },
      basis: "volume",
    },
  };
}

function invalidInput(
  issues: Array<{ path: string; message: string }>,
): ChatbotRecipeWorkflowResult {
  return validateResult({
    ...resultBase,
    status: "error",
    code: "invalid_input",
    message: "Traditional mead refinement contains invalid values.",
    issues,
  });
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}

function validateResult(result: unknown): ChatbotRecipeWorkflowResult {
  return chatbotRecipeWorkflowResultSchema.parse(result);
}
