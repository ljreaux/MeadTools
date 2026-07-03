import assert from "node:assert/strict";
import test from "node:test";
import {
  createRecipeCommentRequestBodySchema,
  recipeCommentListQueryParamsSchema,
  recipeCommentsPageResponseSchema,
  updateRecipeRequestBodySchema
} from "../src/zod/recipes";

test("recipe update schema remains partial", () => {
  assert.equal(
    updateRecipeRequestBodySchema.safeParse({
      private: true,
      lastActivityEmailAt: null
    }).success,
    true
  );
});

test("comment schemas preserve nullable parents and cursor pagination", () => {
  assert.equal(
    createRecipeCommentRequestBodySchema.safeParse({
      comment: "Looks good",
      parent_id: null
    }).success,
    true
  );
  assert.equal(
    recipeCommentListQueryParamsSchema.safeParse({
      limit: 20,
      cursor: "next",
      order: "desc"
    }).success,
    true
  );
  assert.equal(
    recipeCommentsPageResponseSchema.safeParse({
      data: [],
      nextCursor: null,
      totalCount: 0
    }).success,
    true
  );
});

test("recipe schemas reject incompatible payloads", () => {
  assert.equal(
    recipeCommentListQueryParamsSchema.safeParse({ order: "newest" }).success,
    false
  );
  assert.equal(
    createRecipeCommentRequestBodySchema.safeParse({ comment: 10 }).success,
    false
  );
});
