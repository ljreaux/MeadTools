import { z } from "zod";
import { recipeDataV2Schema } from "@meadtools/schemas";
import { apiErrorResponseSchema } from "./catalog";

const adminFailure = <T extends string>(values: [T, ...T[]]) =>
  z.object({ error: z.enum(values) });

export const adminAuthErrorResponseSchema = adminFailure([
  "Authorization header missing",
  "Token missing",
  "Invalid token or unauthorized access",
  "Invalid or expired token",
  "User not found",
  "Server misconfiguration",
  "Unauthorized access",
  "Forbidden – admin access required.",
  "Failed to verify admin",
]);
export const adminRecipesQueryParamsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  query: z.string().optional(),
});
export const adminRecipeListItemResponseSchema = z.object({
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
  users: z
    .object({
      public_username: z.string().nullable(),
      active: z.boolean(),
    })
    .nullable(),
  public_username: z.string(),
  averageRating: z.number(),
  numberOfRatings: z.number(),
});
export const adminRecipesPageResponseSchema = z.object({
  recipes: z.array(adminRecipeListItemResponseSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  page: z.number(),
  limit: z.number(),
});
export const adminRecipesFetchErrorResponseSchema = adminFailure([
  "Failed to fetch recipes",
  "Server misconfiguration",
  "Failed to verify admin",
]);
export const adminUserPathParamsSchema = z.object({ id: z.string() });
const adminUserListItemObjectSchema = z.object({
  id: z.number(),
  email: z.string(),
  role: z.string().nullable(),
  google_id: z.string().nullable(),
  public_username: z.string().nullable(),
  hydro_token: z.string().nullable(),
  active: z.boolean(),
});
export const adminUserListItemResponseSchema = adminUserListItemObjectSchema;
export const adminUsersResponseSchema = z.array(
  adminUserListItemResponseSchema,
);
export const adminUserResponseSchema = adminUserListItemObjectSchema.extend({
  password: z.string().nullable(),
  google_avatar_url: z.string().nullable(),
  show_google_avatar: z.boolean(),
});
export const updateAdminUserRequestBodySchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
  role: z.string().optional(),
  public_username: z.string().optional(),
  google_id: z.string().optional(),
  hydro_token: z.string().optional(),
  updateToken: z.boolean().optional(),
});
export const deleteAdminUserSuccessResponseSchema = z.object({
  message: z.literal("User deleted successfully"),
});
export const adminUsersFetchErrorResponseSchema = adminFailure([
  "Failed to fetch users",
  "Server misconfiguration",
  "Failed to verify admin",
]);
export const adminUserNotFoundErrorResponseSchema = z.object({
  error: z.literal("User not found"),
});
export const adminUserFetchErrorResponseSchema = adminFailure([
  "Failed to fetch user",
  "Server misconfiguration",
  "Failed to verify admin",
]);
export const adminUserUpdateErrorResponseSchema = adminFailure([
  "Failed to update user",
  "Server misconfiguration",
  "Failed to verify admin",
]);
export const adminUserDeleteErrorResponseSchema = adminFailure([
  "Failed to delete user",
  "Server misconfiguration",
  "Failed to verify admin",
]);
export const createBjcpIngredientRequestBodySchema = z.object({
  label: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  value: z.string().nullable().optional(),
});
export const createBjcpIngredientFailureErrorResponseSchema =
  apiErrorResponseSchema;

export const chatAccessModeSchema = z.enum([
  "beta_allowlist",
  "all_active_users",
]);
export const chatAccessStatusResponseSchema = z.object({
  chatEnabled: z.boolean(),
  mode: chatAccessModeSchema,
  granted: z.boolean(),
  paymentRestricted: z.boolean(),
});
export const chatAccessErrorResponseSchema = z.object({ error: z.string() });
export const chatAccessGrantResponseSchema = z.object({
  userId: z.number().int().positive(),
  grantedAt: z.string().datetime(),
  grantedByUserId: z.number().int().positive(),
});
export const chatAccessAdministrationResponseSchema = z.object({
  mode: chatAccessModeSchema,
  updatedAt: z.string().datetime().nullable(),
  grants: z.array(chatAccessGrantResponseSchema),
});
export const updateChatAccessAdministrationRequestBodySchema = z
  .object({
    mode: chatAccessModeSchema,
  })
  .strict();
export const createChatAccessGrantRequestBodySchema = z
  .object({
    userId: z.number().int().positive(),
  })
  .strict();
export const createChatAccessGrantResponseSchema = z.object({
  granted: z.boolean(),
});
export const createChatCreditGrantRequestBodySchema = z
  .object({
    userId: z.number().int().positive(),
    creditAmount: z.number().int().min(1).max(1_000_000),
  })
  .strict();
export const createChatCreditGrantResponseSchema = z.object({
  creditsGranted: z.number().int().positive(),
  availableCredits: z.number().int(),
});
export const chatAccessGrantPathParamsSchema = z.object({
  userId: z.string().regex(/^\d+$/),
});
export const deleteChatAccessGrantResponseSchema = z.object({
  revoked: z.boolean(),
});

export const creditPaymentRecoveryKindSchema = z.enum([
  "stripe_refund",
  "stripe_dispute",
]);
export const creditPaymentRecoveryStatusSchema = z.enum([
  "applied",
  "review_required",
  "resolved",
]);
export const creditPaymentRecoveryResponseSchema = z.object({
  id: z.string().uuid(),
  kind: creditPaymentRecoveryKindSchema,
  status: creditPaymentRecoveryStatusSchema,
  externalReference: z.string(),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  creditDelta: z.number().int().nullable(),
  resolutionCreditDelta: z.number().int().nullable(),
  resolutionNote: z.string().nullable(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  userId: z.number().int().positive(),
  email: z.string().email(),
  publicUsername: z.string().nullable(),
  paymentRestricted: z.boolean(),
  stripeDashboardUrl: z.string().url().nullable(),
  packId: z.string(),
  packCredits: z.number().int().positive(),
});
export const creditPaymentRecoveryAdministrationResponseSchema = z.object({
  recoveries: z.array(creditPaymentRecoveryResponseSchema),
});
export const creditPaymentRecoveryPathParamsSchema = z.object({
  recoveryId: z.string().uuid(),
});
export const resolveCreditPaymentRecoveryRequestBodySchema = z
  .object({
    creditDelta: z.number().int().min(-1_000_000).max(1_000_000),
    note: z.string().trim().min(3).max(500),
    releaseChat: z.boolean(),
  })
  .strict();
export const resolveCreditPaymentRecoveryResponseSchema = z.object({
  resolved: z.literal(true),
  availableCredits: z.number().int().nullable(),
  chatReleased: z.boolean(),
});

const picousdStringSchema = z.string().regex(/^-?\d+$/);
const chatUsageStatusSchema = z.enum(["completed", "failed", "reserved"]);

export const adminChatUsageQueryParamsSchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    environment: z.string().trim().min(1).max(32).optional(),
    model: z.string().trim().min(1).max(255).optional(),
    status: chatUsageStatusSchema.optional(),
    userId: z.coerce.number().int().positive().optional(),
    query: z.string().trim().max(255).optional(),
    page: z.coerce.number().int().min(1).max(10_000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

const chatUsageMetricSchema = z.object({
  requestCount: z.number().int().nonnegative(),
  completedTurns: z.number().int().nonnegative(),
  failedTurns: z.number().int().nonnegative(),
  pendingTurns: z.number().int().nonnegative(),
  unpricedCompletedTurns: z.number().int().nonnegative(),
  providerCalls: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  chargedCredits: z.number().int().nonnegative(),
  providerCostPicousd: picousdStringSchema,
  creditEquivalentPicousd: picousdStringSchema,
  estimatedSpreadPicousd: picousdStringSchema,
});

export const adminChatUsageUserRowSchema = chatUsageMetricSchema.extend({
  userId: z.number().int().positive(),
  email: z.string().email(),
  publicUsername: z.string().nullable(),
  active: z.boolean(),
  chatEnabled: z.boolean(),
  paymentRestricted: z.boolean(),
  availableCredits: z.number().int(),
  lastActivityAt: z.string().datetime().nullable(),
});

export const adminChatUsageDailyRowSchema = chatUsageMetricSchema.extend({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const adminChatUsageModelRowSchema = chatUsageMetricSchema.extend({
  provider: z.string(),
  model: z.string(),
});

export const adminChatUsageReportResponseSchema = z.object({
  filters: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    environment: z.string().nullable(),
    model: z.string().nullable(),
    status: chatUsageStatusSchema.nullable(),
    userId: z.number().int().positive().nullable(),
    query: z.string().nullable(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  }),
  summary: chatUsageMetricSchema.extend({
    activeUsers: z.number().int().nonnegative(),
    paymentRestrictedAccounts: z.number().int().nonnegative(),
    pendingPaymentRecoveries: z.number().int().nonnegative(),
  }),
  daily: z.array(adminChatUsageDailyRowSchema),
  models: z.array(adminChatUsageModelRowSchema),
  users: z.array(adminChatUsageUserRowSchema),
  totalUsers: z.number().int().nonnegative(),
});
