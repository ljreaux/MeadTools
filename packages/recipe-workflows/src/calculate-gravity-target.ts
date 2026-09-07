import { calcABV, calcOG } from "@meadtools/core/gravity";
import { z } from "zod";
import { workflowQuestionSchema } from "./contracts";

export const calculateGravityTargetInputSchema = z
  .object({
    targetAbv: z.number().finite().min(0).max(30),
    fermentationFinalGravity: z.number().finite().min(0.97).max(1.2).optional(),
    additionalOgPoints: z.number().finite().min(0).max(100).optional(),
  })
  .strict();

const gravityTargetBaseSchema = z.object({
  contractVersion: z.literal(1),
  operation: z.literal("calculate_gravity_target"),
});

export const gravityTargetCalculationResultSchema = z.discriminatedUnion(
  "status",
  [
    gravityTargetBaseSchema.extend({
      status: z.literal("needs_input"),
      questions: z.array(workflowQuestionSchema).min(1),
    }),
    gravityTargetBaseSchema.extend({
      status: z.literal("calculation"),
      targetAbv: z.number(),
      fermentationFinalGravity: z.number(),
      baseOriginalGravity: z.number(),
      additionalOgPoints: z.number(),
      targetOriginalGravity: z.number(),
      calculatedAbvAtTargetOg: z.number(),
    }),
    gravityTargetBaseSchema.extend({
      status: z.literal("error"),
      message: z.string(),
    }),
  ],
);

export type GravityTargetCalculationResult = z.infer<
  typeof gravityTargetCalculationResultSchema
>;

/**
 * Finds a target OG with MeadTools' shared ABV equation. This is deliberately
 * separate from recipe creation: it provides a transparent target calculation
 * before the user commits to a complete recipe intake.
 */
export function calculateGravityTarget(
  rawInput: unknown,
): GravityTargetCalculationResult {
  const parsed = calculateGravityTargetInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      contractVersion: 1,
      operation: "calculate_gravity_target",
      status: "error",
      message: "The gravity target calculation contains invalid values.",
    };
  }

  if (parsed.data.fermentationFinalGravity === undefined) {
    return {
      contractVersion: 1,
      operation: "calculate_gravity_target",
      status: "needs_input",
      questions: [
        {
          id: "fermentation_final_gravity",
          field: "fermentationFinalGravity",
          prompt:
            "What fermentation final gravity should MeadTools use for the target ABV calculation?",
          answerType: "number",
        },
      ],
    };
  }

  try {
    const additionalOgPoints = parsed.data.additionalOgPoints ?? 0;
    const baseOriginalGravity = calcOG(
      parsed.data.targetAbv,
      parsed.data.fermentationFinalGravity,
    );
    const targetOriginalGravity =
      baseOriginalGravity + additionalOgPoints / 1_000;

    if (targetOriginalGravity > 1.2) {
      return {
        contractVersion: 1,
        operation: "calculate_gravity_target",
        status: "error",
        message:
          "The calculated original gravity is above the hosted traditional-mead workflow limit of 1.200.",
      };
    }

    return {
      contractVersion: 1,
      operation: "calculate_gravity_target",
      status: "calculation",
      targetAbv: parsed.data.targetAbv,
      fermentationFinalGravity: parsed.data.fermentationFinalGravity,
      baseOriginalGravity,
      additionalOgPoints,
      targetOriginalGravity,
      calculatedAbvAtTargetOg: calcABV(
        targetOriginalGravity,
        parsed.data.fermentationFinalGravity,
      ),
    };
  } catch (error) {
    return {
      contractVersion: 1,
      operation: "calculate_gravity_target",
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "MeadTools could not calculate the gravity target.",
    };
  }
}
