import { z } from "zod";
import { recipeDataV2Schema } from "@meadtools/schemas";

const recipeRecordSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable(),
  name: z.string(),
  recipeData: z.string(),
  yanFromSource: z.string().nullable(),
  yanContribution: z.string(),
  nutrientData: z.string(),
  advanced: z.boolean(),
  nuteInfo: z.string().nullable(),
  primaryNotes: z.array(z.string()),
  secondaryNotes: z.array(z.string()),
  dataV2: recipeDataV2Schema.nullable(),
  version: z.number(),
  private: z.boolean(),
  lastActivityEmailAt: z.string().nullable(),
  activityEmailsEnabled: z.boolean()
});

const createRecipeRequestObjectSchema = z.object({
  name: z.string(),
  dataV2: recipeDataV2Schema,
  private: z.boolean().optional(),
  activityEmailsEnabled: z.boolean().optional(),
  lastActivityEmailAt: z.string().nullable().optional()
});

export const createRecipeRequestBodySchema =
  createRecipeRequestObjectSchema;
export const createRecipeResponseSchema =
  z.object({ recipe: recipeRecordSchema });
export const createRecipeValidationErrorResponseSchema =
  z.object({
    error: z.enum([
      "Name and recipe data are required.",
      "Invalid dataV2 payload."
    ])
  });
export const createRecipeFailureErrorResponseSchema =
  z.object({
    error: z.enum(["Failed to create recipe", "Server misconfiguration"])
  });
export const updateRecipeRequestBodySchema =
  createRecipeRequestObjectSchema.partial();
export const updateRecipeResponseSchema =
  recipeRecordSchema;
export const updateRecipeValidationErrorResponseSchema =
  z.object({ error: z.enum(["Invalid recipe ID", "Invalid payload"]) });
export const updateRecipeForbiddenErrorResponseSchema =
  z.object({
    error: z.literal("You are not authorized to update this recipe")
  });
export const updateRecipeFailureErrorResponseSchema =
  z.object({
    error: z.enum(["Failed to update recipe", "Server misconfiguration"])
  });
export const deleteRecipeSuccessResponseSchema =
  z.object({ message: z.string() });
export const deleteRecipeForbiddenErrorResponseSchema =
  z.object({
    error: z.literal("You are not authorized to delete this recipe")
  });
export const deleteRecipeFailureErrorResponseSchema =
  z.object({
    error: z.enum(["Failed to delete recipe", "Server misconfiguration"])
  });

export const rateRecipeRequestBodySchema =
  z.object({ rating: z.number() });
export const recipeRatingAggregateResponseSchema =
  z.object({
    recipe_id: z.number(),
    averageRating: z.number(),
    numberOfRatings: z.number(),
    userRating: z.number()
  });
export const rateRecipeResponseSchema =
  z.object({ rating: recipeRatingAggregateResponseSchema });
export const rateRecipeValidationErrorResponseSchema =
  z.object({
    error: z.enum(["Invalid recipe ID", "Rating is a required field"])
  });
export const rateRecipeFailureErrorResponseSchema =
  z.object({
    error: z.enum(["Failed to add rating", "Server misconfiguration"])
  });

export const recipeCommentResponseSchema =
  z.object({
    id: z.string(),
    recipe_id: z.number(),
    user_id: z.number(),
    parent_id: z.string().nullable(),
    comment: z.string(),
    created_at: z.string(),
    updated_at: z.string()
  });
export const createRecipeCommentRequestBodySchema =
  z.object({
    comment: z.string(),
    parent_id: z.string().nullable().optional()
  });
export const createRecipeCommentResponseSchema =
  z.object({ comment: recipeCommentResponseSchema });
export const createRecipeCommentValidationErrorResponseSchema =
  z.object({
    error: z.enum(["Invalid recipe ID", "Comment text is required"])
  });
export const createRecipeCommentFailureErrorResponseSchema =
  z.object({
    error: z.enum(["Failed to add comment", "Server misconfiguration"])
  });
export const recipeCommentListPathParamsSchema =
  z.object({ id: z.string() });
export const recipeCommentRepliesPathParamsSchema =
  z.object({ id: z.string(), commentId: z.string() });
export const recipeCommentListQueryParamsSchema =
  z.object({
    limit: z.number().optional(),
    cursor: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional()
  });
export const recipeCommentAuthorResponseSchema =
  z.object({
    public_username: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    active: z.boolean().optional()
  });
export const recipeCommentListItemResponseSchema =
  z.object({
    id: z.string(),
    recipe_id: z.number(),
    user_id: z.number(),
    parent_id: z.string().nullable(),
    comment: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable(),
    reply_count: z.number(),
    author: recipeCommentAuthorResponseSchema.nullable()
  });
export const recipeCommentsPageResponseSchema =
  z.object({
    data: z.array(recipeCommentListItemResponseSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number()
  });
export const recipeCommentsValidationErrorResponseSchema =
  z.object({ error: z.enum(["Invalid recipe id", "Missing commentId"]) });
export const recipeCommentsFetchErrorResponseSchema =
  z.object({ error: z.literal("Failed to fetch comments") });
export const recipeCommentPathParamsSchema =
  z.object({ id: z.string() });
export const updateRecipeCommentRequestBodySchema =
  z.object({ comment: z.string() });
export const updateRecipeCommentResponseSchema =
  z.object({ comment: recipeCommentResponseSchema });
export const deleteRecipeCommentResponseSchema =
  z.object({
    deleted: z.object({
      id: z.string(),
      deleted_at: z.string().nullable()
    })
  });
export const updateRecipeCommentValidationErrorResponseSchema =
  z.object({ error: z.literal("Comment text is required") });
export const updateRecipeCommentFailureErrorResponseSchema =
  z.object({
    error: z.enum(["Failed to update comment", "Server misconfiguration"])
  });
export const deleteRecipeCommentFailureErrorResponseSchema =
  z.object({
    error: z.enum(["Failed to delete comment", "Server misconfiguration"])
  });
