import { z } from "zod";
import { recipeDataV2Schema } from "@meadtools/schemas";
import { apiErrorResponseSchema } from "./catalog";

const adminFailure = <T extends string>(values: [T, ...T[]]) =>
  z.object({ error: z.enum(values) });

export const adminAuthErrorResponseSchema =
  adminFailure([
    "Authorization header missing", "Token missing",
    "Invalid token or unauthorized access", "Invalid or expired token",
    "User not found", "Server misconfiguration", "Unauthorized access",
    "Forbidden – admin access required.", "Failed to verify admin"
  ]);
export const adminRecipesQueryParamsSchema =
  z.object({
    page: z.string().optional(), limit: z.string().optional(),
    query: z.string().optional()
  });
export const adminRecipeListItemResponseSchema =
  z.object({
    id: z.number(), user_id: z.number().nullable(), name: z.string(),
    recipeData: z.string(), yanFromSource: z.string().nullable(),
    yanContribution: z.string(), nutrientData: z.string(), advanced: z.boolean(),
    nuteInfo: z.string().nullable(), primaryNotes: z.array(z.array(z.string())),
    secondaryNotes: z.array(z.array(z.string())),
    dataV2: recipeDataV2Schema.nullable(), version: z.number(),
    private: z.boolean(), lastActivityEmailAt: z.string().nullable(),
    activityEmailsEnabled: z.boolean(),
    users: z.object({
      public_username: z.string().nullable(), active: z.boolean()
    }).nullable(),
    public_username: z.string(), averageRating: z.number(),
    numberOfRatings: z.number()
  });
export const adminRecipesPageResponseSchema =
  z.object({
    recipes: z.array(adminRecipeListItemResponseSchema),
    totalCount: z.number(), totalPages: z.number(),
    page: z.number(), limit: z.number()
  });
export const adminRecipesFetchErrorResponseSchema =
  adminFailure(["Failed to fetch recipes", "Server misconfiguration", "Failed to verify admin"]);
export const adminUserPathParamsSchema =
  z.object({ id: z.string() });
const adminUserListItemObjectSchema = z.object({
  id: z.number(), email: z.string(), role: z.string().nullable(),
  google_id: z.string().nullable(), public_username: z.string().nullable(),
  hydro_token: z.string().nullable(), active: z.boolean()
});
export const adminUserListItemResponseSchema =
  adminUserListItemObjectSchema;
export const adminUsersResponseSchema =
  z.array(adminUserListItemResponseSchema);
export const adminUserResponseSchema =
  adminUserListItemObjectSchema.extend({
    password: z.string().nullable(), google_avatar_url: z.string().nullable(),
    show_google_avatar: z.boolean()
  });
export const updateAdminUserRequestBodySchema =
  z.object({
    email: z.string().optional(), password: z.string().optional(),
    role: z.string().optional(), public_username: z.string().optional(),
    google_id: z.string().optional(), hydro_token: z.string().optional(),
    updateToken: z.boolean().optional()
  });
export const deleteAdminUserSuccessResponseSchema =
  z.object({ message: z.literal("User deleted successfully") });
export const adminUsersFetchErrorResponseSchema =
  adminFailure(["Failed to fetch users", "Server misconfiguration", "Failed to verify admin"]);
export const adminUserNotFoundErrorResponseSchema =
  z.object({ error: z.literal("User not found") });
export const adminUserFetchErrorResponseSchema =
  adminFailure(["Failed to fetch user", "Server misconfiguration", "Failed to verify admin"]);
export const adminUserUpdateErrorResponseSchema =
  adminFailure(["Failed to update user", "Server misconfiguration", "Failed to verify admin"]);
export const adminUserDeleteErrorResponseSchema =
  adminFailure(["Failed to delete user", "Server misconfiguration", "Failed to verify admin"]);
export const createBjcpIngredientRequestBodySchema =
  z.object({
    label: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    value: z.string().nullable().optional()
  });
export const createBjcpIngredientFailureErrorResponseSchema =
  apiErrorResponseSchema;
