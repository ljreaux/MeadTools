import assert from "node:assert/strict";
import test from "node:test";

import { formatRecipePdfNumber } from "../../components/recipeBuilder/recipePdfModel";

test("recipe PDF numbers use locale-aware rounding and optional fixed precision", () => {
  assert.equal(formatRecipePdfNumber(1.23456, 3, "en-US"), "1.235");
  assert.equal(
    formatRecipePdfNumber(1, 3, "en-US", { fixed: true }),
    "1.000"
  );
});

test("recipe PDF number bounds prevent invalid presentation values", () => {
  assert.equal(
    formatRecipePdfNumber(-2.5, 2, "en-US", { minimum: 0 }),
    "0"
  );
  assert.equal(
    formatRecipePdfNumber(150, 0, "en-US", { maximum: 100 }),
    "100"
  );
  assert.equal(formatRecipePdfNumber(Number.NaN, 2, "en-US"), "—");
});
