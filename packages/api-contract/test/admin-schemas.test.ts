import assert from "node:assert/strict";
import test from "node:test";
import {
  adminAuthErrorResponseSchema,
  adminRecipesQueryParamsSchema,
  adminUserResponseSchema,
  updateAdminUserRequestBodySchema
} from "../src/zod/admin";

test("admin schemas preserve query and partial update shapes", () => {
  assert.equal(
    adminRecipesQueryParamsSchema.safeParse({
      page: "1",
      limit: "20",
      query: "traditional"
    }).success,
    true
  );
  assert.equal(
    updateAdminUserRequestBodySchema.safeParse({ updateToken: true }).success,
    true
  );
});

test("admin user schema preserves nullable authentication fields", () => {
  assert.equal(
    adminUserResponseSchema.safeParse({
      id: 1,
      email: "admin@example.com",
      password: null,
      google_id: null,
      role: "admin",
      hydro_token: null,
      public_username: null,
      google_avatar_url: null,
      show_google_avatar: false,
      active: true
    }).success,
    true
  );
});

test("admin errors retain exact public literals", () => {
  assert.equal(
    adminAuthErrorResponseSchema.safeParse({
      error: "Forbidden – admin access required."
    }).success,
    true
  );
  assert.equal(
    adminAuthErrorResponseSchema.safeParse({ error: "Forbidden" }).success,
    false
  );
});
