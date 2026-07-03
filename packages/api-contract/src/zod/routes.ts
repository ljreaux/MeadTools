import { z } from "zod";
import { recipeDataV2Schema } from "@meadtools/schemas";

export const contactRequestBodySchema = z.object({
  user_name: z.string(),
  user_email: z.string(),
  message: z.string()
});
export const contactSuccessResponseSchema = z.object({
  message: z.literal("Email sent successfully")
});
export const contactValidationErrorResponseSchema = z.object({
  message: z.literal("All fields are required")
});
export const contactSendErrorResponseSchema = z.object({
  message: z.literal("Failed to send email")
});

export const bjcpIngredientResponseSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  label: z.string().nullable(),
  category: z.string().nullable(),
  value: z.string().nullable()
});
export const bjcpIngredientsResponseSchema = z.array(bjcpIngredientResponseSchema);
export const bjcpIngredientsFetchErrorResponseSchema = z.object({
  error: z.literal("Failed to fetch ingredients")
});

export const publicRecipesQueryParamsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  q: z.string().optional(),
  query: z.string().optional()
});
export const publicRecipeOwnerResponseSchema = z.object({
  public_username: z.string().nullable(),
  active: z.boolean()
});
export const publicRecipeListItemResponseSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable(),
  name: z.string(),
  recipeData: z.string(),
  yanFromSource: z.string().nullable(),
  yanContribution: z.string(),
  nutrientData: z.string(),
  advanced: z.boolean(),
  nuteInfo: z.string().nullable(),
  primaryNotes: z.array(z.array(z.string())),
  secondaryNotes: z.array(z.array(z.string())),
  dataV2: recipeDataV2Schema.nullable(),
  version: z.number(),
  private: z.boolean(),
  lastActivityEmailAt: z.string().nullable(),
  activityEmailsEnabled: z.boolean(),
  users: publicRecipeOwnerResponseSchema.nullable(),
  public_username: z.string(),
  averageRating: z.number(),
  numberOfRatings: z.number()
});
export const publicRecipesPageResponseSchema = z.object({
  recipes: z.array(publicRecipeListItemResponseSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  page: z.number(),
  limit: z.number()
});
export const publicRecipesFetchErrorResponseSchema = z.object({
  error: z.literal("Failed to fetch recipes")
});

export const recipePathParamsSchema = z.object({ id: z.string() });
export const recipeOwnerResponseSchema = z.object({
  public_username: z.string().nullable(),
  active: z.boolean()
});
export const recipeRatingResponseSchema = z.object({
  rating: z.number(),
  user_id: z.number()
});
export const recipeDetailResponseSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable(),
  name: z.string(),
  recipeData: z.string(),
  yanFromSource: z.string().nullable(),
  yanContribution: z.string(),
  nutrientData: z.string(),
  advanced: z.boolean(),
  nuteInfo: z.string().nullable(),
  primaryNotes: z.array(z.array(z.string())),
  secondaryNotes: z.array(z.array(z.string())),
  dataV2: recipeDataV2Schema.nullable(),
  version: z.number(),
  private: z.boolean(),
  lastActivityEmailAt: z.string().nullable(),
  activityEmailsEnabled: z.boolean(),
  users: recipeOwnerResponseSchema.nullable(),
  ratings: z.array(recipeRatingResponseSchema),
  public_username: z.string().nullable(),
  averageRating: z.number().nullable()
});
export const getRecipeResponseSchema = z.object({
  recipe: recipeDetailResponseSchema
});
export const invalidRecipeIdErrorResponseSchema = z.object({
  error: z.literal("Invalid recipe ID")
});
export const recipeNotFoundErrorResponseSchema = z.object({
  error: z.enum(["Recipe not found", "User not found"])
});
export const recipeForbiddenErrorResponseSchema = z.object({
  error: z.literal("You are not authorized to view this recipe")
});
export const recipeFetchErrorResponseSchema = z.object({
  error: z.enum([
    "An error occurred while fetching the recipe",
    "Server misconfiguration"
  ])
});
