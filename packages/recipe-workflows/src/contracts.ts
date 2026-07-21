import { z } from "zod";
import { recipeDerivedStateResponseSchema } from "@meadtools/api-contract/schemas";
import { recipeDataV2Schema } from "@meadtools/schemas/recipe";

export const workflowQuestionSchema = z.object({
  id: z.string(),
  field: z.string(),
  prompt: z.string(),
  answerType: z.enum(["number", "boolean", "select", "object"]),
  options: z.array(z.string()).optional()
});

const workflowResultBaseSchema = z.object({
  contractVersion: z.literal(1),
  operation: z.literal("create_traditional")
});

export const needsInputResultSchema = workflowResultBaseSchema.extend({
  status: z.literal("needs_input"),
  questions: z.array(workflowQuestionSchema).min(1)
});

export const recipeResultSchema = workflowResultBaseSchema.extend({
  status: z.literal("recipe"),
  recipeData: recipeDataV2Schema,
  derived: recipeDerivedStateResponseSchema,
  assumptions: z.array(z.string()),
  warnings: z.array(z.string())
});

export const workflowErrorResultSchema = workflowResultBaseSchema.extend({
  status: z.literal("error"),
  code: z.enum(["invalid_input", "invalid_recipe", "calculation_failed"]),
  message: z.string(),
  issues: z
    .array(
      z.object({
        path: z.string(),
        message: z.string()
      })
    )
    .optional()
});

export const chatbotRecipeWorkflowResultSchema = z.discriminatedUnion(
  "status",
  [needsInputResultSchema, recipeResultSchema, workflowErrorResultSchema]
);

export type WorkflowQuestion = z.infer<typeof workflowQuestionSchema>;
export type ChatbotRecipeWorkflowResult = z.infer<
  typeof chatbotRecipeWorkflowResultSchema
>;
