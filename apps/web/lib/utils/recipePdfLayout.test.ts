import assert from "node:assert/strict";
import test from "node:test";

import {
  RECIPE_PDF_COLUMN_WIDTHS,
  toPercentageWidths
} from "../../components/recipeBuilder/recipePdfLayout";

test("recipe PDF column layouts fill the table width", () => {
  for (const widths of Object.values(RECIPE_PDF_COLUMN_WIDTHS)) {
    assert.equal(
      widths.reduce((total, width) => total + width, 0),
      100
    );
  }
});

test("recipe PDF column layouts convert to shared percentage values", () => {
  assert.deepEqual(
    toPercentageWidths(RECIPE_PDF_COLUMN_WIDTHS.ingredients),
    ["80%", "10%", "10%"]
  );
});
