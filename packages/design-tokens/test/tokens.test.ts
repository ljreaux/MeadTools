import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { renderDesignTokenCss } from "../src/css";
import {
  brandColors,
  colorThemes,
  designTokens,
  webColorChannels
} from "../src/index";

test("preserves the established MeadTools web brand values", () => {
  assert.equal(brandColors.honey, "hsl(38, 54%, 56%)");
  assert.equal(colorThemes.dark.background, "hsl(0, 0%, 14%)");
  assert.equal(colorThemes.dark.text, "hsl(36, 16%, 82%)");
  assert.equal(webColorChannels.light.primary, "222.2, 47.4%, 11.2%");
});

test("keeps generated CSS variables in parity with typed tokens", async () => {
  const cssUrl = new URL("../tokens.css", import.meta.url);
  const committedCss = await readFile(cssUrl, "utf8");

  assert.equal(committedCss, renderDesignTokenCss());
  assert.equal(
    committedCss.includes(
      `--mt-color-brand-honey: ${designTokens.color.brand.honey};`
    ),
    true
  );
  assert.match(
    committedCss,
    /--mt-web-dark-background: 0, 0%, 14%/
  );
});
