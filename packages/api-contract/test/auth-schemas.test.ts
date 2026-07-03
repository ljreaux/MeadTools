import assert from "node:assert/strict";
import test from "node:test";
import {
  accountInfoResponseSchema,
  loginSuccessResponseSchema,
  refreshTokenFailureErrorResponseSchema,
  registerRequestBodySchema,
  verifyTokenRequestBodySchema
} from "../src/zod/auth";

test("auth schemas preserve existing successful payloads", () => {
  assert.equal(
    loginSuccessResponseSchema.safeParse({
      message: "Successfully logged in!",
      accessToken: "access",
      refreshToken: "refresh",
      role: "user",
      email: "user@example.com",
      id: 1
    }).success,
    true
  );
  assert.equal(
    registerRequestBodySchema.safeParse({
      email: "user@example.com",
      password: "password",
      public_username: "meadmaker"
    }).success,
    true
  );
});

test("auth schemas preserve current literal errors and provider contract", () => {
  assert.equal(
    refreshTokenFailureErrorResponseSchema.safeParse({
      error: "Invalid refresh token"
    }).success,
    true
  );
  assert.equal(
    verifyTokenRequestBodySchema.safeParse({
      token: "google-token",
      provider: "google"
    }).success,
    true
  );
  assert.equal(
    verifyTokenRequestBodySchema.safeParse({
      token: "token",
      provider: "other"
    }).success,
    false
  );
});

test("account schema accepts current nullable and legacy recipe fields", () => {
  assert.equal(
    accountInfoResponseSchema.safeParse({
      user: {
        id: 1,
        email: "user@example.com",
        google_id: null,
        role: null,
        hydro_token: null,
        public_username: null,
        google_avatar_url: null,
        show_google_avatar: false,
        active: true,
        isGoogleUser: false
      },
      recipes: []
    }).success,
    true
  );
});
