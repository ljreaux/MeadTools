import { z } from "zod";
import { recipeDataV2Schema } from "@meadtools/schemas";

export const loginRequestBodySchema = z.object({
  email: z.string(),
  password: z.string()
});
export const loginSuccessResponseSchema =
  z.object({
    message: z.literal("Successfully logged in!"),
    accessToken: z.string(),
    refreshToken: z.string(),
    role: z.string().nullable(),
    email: z.string(),
    id: z.number()
  });
export const loginMissingCredentialsErrorResponseSchema =
  z.object({ error: z.literal("Please provide email and password") });
export const loginInvalidCredentialsErrorResponseSchema =
  z.object({ error: z.literal("Invalid email or password") });
export const loginFailureErrorResponseSchema =
  z.object({ error: z.literal("Failed to log in user") });

export const registerRequestBodySchema =
  z.object({
    email: z.string(),
    password: z.string(),
    public_username: z.string().optional()
  });
export const registerSuccessResponseSchema =
  z.object({
    message: z.literal("Thank you for signing up!"),
    accessToken: z.string(),
    refreshToken: z.string(),
    role: z.string().nullable(),
    email: z.string()
  });
export const registerValidationErrorResponseSchema =
  z.object({
    error: z.enum([
      "Email and password are required.",
      "A user by that email already exists"
    ])
  });
export const registerFailureErrorResponseSchema =
  z.object({ error: z.literal("Failed to register user") });

export const refreshTokenRequestBodySchema =
  z.object({ email: z.string(), refreshToken: z.string() });
export const refreshTokenSuccessResponseSchema =
  z.object({ accessToken: z.string() });
export const refreshTokenValidationErrorResponseSchema =
  z.object({ error: z.literal("Email and refreshToken are required") });
export const refreshTokenInvalidEmailErrorResponseSchema =
  z.object({ error: z.literal("Invalid email") });
export const refreshTokenFailureErrorResponseSchema =
  z.object({
    error: z.enum(["Invalid refresh token", "Failed to refresh token"])
  });

export const requestPasswordResetBodySchema =
  z.object({ email: z.string() });
export const requestPasswordResetSuccessResponseSchema =
  z.object({
    message: z.enum([
      "If that email exists, a reset link has been sent.",
      "Reset link sent."
    ])
  });
export const requestPasswordResetValidationErrorResponseSchema =
  z.object({ error: z.literal("Email is required") });
export const resetPasswordRequestBodySchema =
  z.object({ token: z.string(), password: z.string() });
export const resetPasswordSuccessResponseSchema =
  z.object({ message: z.literal("Password updated successfully.") });
export const resetPasswordValidationErrorResponseSchema =
  z.object({ error: z.literal("Missing token or password.") });
export const resetPasswordInvalidTokenErrorResponseSchema =
  z.object({ error: z.literal("Invalid or expired token.") });

export const verifyTokenRequestBodySchema =
  z.object({
    token: z.string(),
    provider: z.literal("google"),
    email: z.string().optional()
  });
export const verifyTokenUserResponseSchema =
  z.object({ id: z.number(), email: z.string(), role: z.string() });
export const verifyTokenSuccessResponseSchema =
  z.object({
    token: z.string(),
    accessToken: z.string(),
    refreshToken: z.string(),
    user: verifyTokenUserResponseSchema
  });
export const verifyTokenValidationErrorResponseSchema =
  z.object({
    error: z.enum([
      "Invalid provider",
      "Email required when using access token"
    ])
  });
export const verifyTokenUnauthorizedErrorResponseSchema =
  z.object({ error: z.enum(["Invalid token", "Invalid ID token"]) });
export const verifyTokenNotFoundErrorResponseSchema =
  z.object({ error: z.literal("User not found") });
export const verifyTokenFailureErrorResponseSchema =
  z.object({ error: z.literal("Authentication failed") });

const accountUserResponseObjectSchema = z.object({
  id: z.number(),
  email: z.string(),
  password: z.undefined().optional(),
  google_id: z.string().nullable(),
  role: z.string().nullable(),
  hydro_token: z.string().nullable(),
  public_username: z.string().nullable(),
  google_avatar_url: z.string().nullable(),
  show_google_avatar: z.boolean(),
  active: z.boolean(),
  isGoogleUser: z.boolean()
});
export const accountUserResponseSchema =
  accountUserResponseObjectSchema;
export const accountRecipeOwnerResponseSchema =
  z.object({ public_username: z.string().nullable() });
export const accountRecipeResponseSchema =
  z.object({
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
    users: accountRecipeOwnerResponseSchema.nullable(),
    public_username: z.string().nullable()
  });
export const accountInfoResponseSchema =
  z.object({
    user: accountUserResponseSchema,
    recipes: z.array(accountRecipeResponseSchema)
  });
export const accountInfoUnauthorizedErrorResponseSchema =
  z.object({ error: z.literal("Unauthorized") });
export const accountInfoNotFoundErrorResponseSchema =
  z.object({ error: z.literal("User not found") });
export const accountInfoFetchErrorResponseSchema =
  z.object({ error: z.literal("Failed to fetch account info") });
export const updateAccountInfoRequestBodySchema =
  z.object({
    email: z.string().optional(),
    password: z.string().optional(),
    public_username: z.string().optional(),
    google_id: z.string().optional(),
    hydro_token: z.string().optional(),
    role: z.string().optional()
  });
export const updateAccountInfoResponseSchema =
  accountUserResponseObjectSchema.omit({ isGoogleUser: true });
export const updateAccountInfoErrorResponseSchema =
  z.object({ error: z.literal("Failed to update account info") });
export const createUsernameRequestBodySchema =
  z.object({ public_username: z.string() });
export const createUsernameSuccessResponseSchema =
  z.object({
    message: z.literal("Public username successfully updated."),
    public_username: z.string().nullable()
  });
export const createUsernameValidationErrorResponseSchema =
  z.object({ error: z.literal("Public username is required.") });
export const createUsernameFailureErrorResponseSchema =
  z.object({
    error: z.enum([
      "Failed to update public username.",
      "Server misconfiguration"
    ])
  });
