import { z } from "zod";
import { recipeDerivedStateResponseBodySchema } from "@meadtools/api-contract/schemas";
import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";
import { recipeDataV2Schema } from "@meadtools/schemas";
import {
  chatbotRecipeWorkflowResultSchema,
  type ChatbotRecipeWorkflowResult,
  type RecipeExplanation,
} from "./contracts";

const explanationTopicSchema = z.enum([
  "abv",
  "gravity",
  "volume",
  "nutrients",
  "stabilizers",
]);

export const explainRecipeInputSchema = z
  .object({
    activeRecipeData: recipeDataV2Schema,
    topic: explanationTopicSchema.optional(),
  })
  .strict();

export type ExplainRecipeInput = z.infer<typeof explainRecipeInputSchema>;

const resultBase = {
  contractVersion: 1 as const,
  operation: "explain_recipe" as const,
};

/**
 * Return calculation-engine facts for an active draft. A model may rephrase the
 * result, but must not substitute its own calculation for these values.
 */
export function explainRecipe(rawInput: unknown): ChatbotRecipeWorkflowResult {
  const parsedInput = explainRecipeInputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return validateResult({
      ...resultBase,
      status: "error",
      code: "invalid_input",
      message: "Recipe explanation contains invalid values.",
      issues: parsedInput.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (!parsedInput.data.topic) {
    return validateResult({
      ...resultBase,
      status: "needs_input",
      questions: [
        {
          id: "explanation_topic",
          field: "topic",
          prompt: "Which calculated recipe value should MeadTools explain?",
          answerType: "select",
          options: explanationTopicSchema.options,
        },
      ],
    });
  }

  try {
    const calculated = calculateRecipeDerivedApiResponse(
      parsedInput.data.activeRecipeData,
    );
    const authoritativeResult =
      recipeDerivedStateResponseBodySchema.safeParse(calculated);
    if (!authoritativeResult.success) {
      return validationError(
        authoritativeResult.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      );
    }

    return validateResult({
      ...resultBase,
      status: "recipe",
      recipeData: authoritativeResult.data.recipeData,
      derived: authoritativeResult.data.derived,
      assumptions: [
        "Explanation facts come from a fresh MeadTools calculation of the active draft.",
      ],
      warnings: ["This explanation does not save or modify the recipe draft."],
      explanation: buildExplanation(
        parsedInput.data.topic,
        authoritativeResult.data.recipeData.fg,
        authoritativeResult.data.derived,
      ),
    });
  } catch (error) {
    return validateResult({
      ...resultBase,
      status: "error",
      code: "calculation_failed",
      message:
        error instanceof Error
          ? error.message
          : "MeadTools could not calculate the recipe explanation.",
    });
  }
}

function buildExplanation(
  topic: ExplainRecipeInput["topic"] & {},
  fermentationFinalGravity: string,
  derived: ReturnType<typeof calculateRecipeDerivedApiResponse>["derived"],
): RecipeExplanation {
  switch (topic) {
    case "abv":
      return {
        topic,
        summary:
          "The authoritative calculation engine derived ABV from this draft's original and fermentation final gravities.",
        facts: [
          { label: "Original gravity", value: derived.gravity.ogPrimary },
          {
            label: "Fermentation final gravity",
            value: Number(fermentationFinalGravity),
          },
          { label: "Alcohol by volume", value: derived.alcohol.abv },
        ],
      };
    case "gravity":
      return {
        topic,
        summary:
          "The authoritative calculation engine derived the recipe's gravity values from its ingredient amounts and final gravity input.",
        facts: [
          {
            label: "Primary original gravity",
            value: derived.gravity.ogPrimary,
          },
          {
            label: "Fermentation final gravity",
            value: Number(fermentationFinalGravity),
          },
          {
            label: "Backsweetened final gravity",
            value: derived.gravity.backsweetenedFg,
          },
        ],
      };
    case "volume":
      return {
        topic,
        summary:
          "The authoritative calculation engine derived volume from the ingredient amounts in the active draft.",
        facts: [
          { label: "Primary volume (L)", value: derived.volume.primaryL },
          { label: "Secondary volume (L)", value: derived.volume.secondaryL },
          { label: "Total volume (L)", value: derived.volume.totalL },
        ],
      };
    case "nutrients":
      return {
        topic,
        summary:
          "The authoritative calculation engine derived this nutrient plan from the active recipe and nutrient inputs.",
        facts: [
          { label: "Target YAN (ppm)", value: derived.nutrients.targetYanPpm },
          {
            label: "Number of additions",
            value: derived.nutrients.numberOfAdditions,
          },
          {
            label: "Total nutrient grams",
            value: Object.values(derived.nutrients.nutrientAdditions.totalGrams)
              .filter((value) => typeof value === "number")
              .reduce((total, value) => total + value, 0),
          },
        ],
      };
    case "stabilizers":
      return {
        topic,
        summary:
          "The authoritative calculation engine derived stabilizer guidance from the active draft's pH, volume, and alcohol values.",
        facts: [
          {
            label: "Potassium sorbate grams",
            value: derived.stabilizers.sorbate,
          },
          {
            label: "Selected metabisulfite grams",
            value: derived.stabilizers.sulfite,
          },
          { label: "Campden tablets", value: derived.stabilizers.campden },
        ],
      };
  }
}

function validationError(
  issues: Array<{ path: string; message: string }>,
): ChatbotRecipeWorkflowResult {
  return validateResult({
    ...resultBase,
    status: "error",
    code: "calculation_failed",
    message: "Calculated recipe data failed the API response contract.",
    issues,
  });
}

function validateResult(result: unknown): ChatbotRecipeWorkflowResult {
  return chatbotRecipeWorkflowResultSchema.parse(result);
}
