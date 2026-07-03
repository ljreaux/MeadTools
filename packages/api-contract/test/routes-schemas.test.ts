import assert from "node:assert/strict";
import test from "node:test";
import {
  bjcpIngredientResponseSchema,
  contactRequestBodySchema,
  contactSuccessResponseSchema,
  publicRecipesQueryParamsSchema,
  recipeDetailResponseSchema,
  recipeForbiddenErrorResponseSchema
} from "../src/zod/routes";

test("route schemas preserve contact and BJCP payloads", () => {
  assert.equal(
    contactRequestBodySchema.safeParse({
      user_name: "Mead Maker",
      user_email: "maker@example.com",
      message: "Hello"
    }).success,
    true
  );
  assert.equal(
    contactSuccessResponseSchema.safeParse({
      message: "Email sent successfully"
    }).success,
    true
  );
  assert.equal(
    bjcpIngredientResponseSchema.safeParse({
      id: "ingredient-id",
      created_at: "2026-07-02T00:00:00.000Z",
      label: null,
      category: "fruit",
      value: null
    }).success,
    true
  );
});

test("public recipe query and error schemas preserve the documented API", () => {
  assert.equal(
    publicRecipesQueryParamsSchema.safeParse({
      page: "2",
      limit: "25",
      q: "berry"
    }).success,
    true
  );
  assert.equal(
    recipeForbiddenErrorResponseSchema.safeParse({
      error: "You are not authorized to view this recipe"
    }).success,
    true
  );
  assert.equal(
    recipeForbiddenErrorResponseSchema.safeParse({
      error: "Unauthorized"
    }).success,
    false
  );
});

test("recipe detail schema requires the established response fields", () => {
  assert.equal(recipeDetailResponseSchema.safeParse({ id: 1 }).success, false);
});
