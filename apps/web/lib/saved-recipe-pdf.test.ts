import assert from "node:assert/strict";
import test from "node:test";
import { recipePdfResponseSchema } from "@meadtools/api-contract";

import { renderSavedRecipePdf } from "./saved-recipe-pdf";
import { traditionalRecipeFixture } from "./utils/__fixtures__/recipeDerivedFixtures";

test("renders an owned saved recipe into a shareable PDF using the web layout", async () => {
  const result = await renderSavedRecipePdf({
    data: traditionalRecipeFixture,
    title: "Recipe export test",
    publicUsername: "MeadTools test",
    locale: "de"
  });
  assert.deepEqual(recipePdfResponseSchema.parse(result), result);
  assert.equal(result.filename, "recipe-export-test.pdf");
  const pdf = Buffer.from(result.base64, "base64");
  assert.match(pdf.toString("ascii", 0, 8), /^%PDF-/);
  assert.match(pdf.toString("latin1"), /\/Type \/Page\b/);
});
