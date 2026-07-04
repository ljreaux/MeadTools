import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { renderDesignTokenCss } from "../src/css";
import { brandColors, colorThemes, designTokens } from "../src/index";

test("preserves the established MeadTools mobile brand values", () => {
  assert.equal(brandColors.honey, "#F5A623");
  assert.equal(colorThemes.dark.background, "#171717");
  assert.equal(colorThemes.dark.surface, "#262626");
  assert.equal(colorThemes.dark.text, "#FAFAFA");
});

test("keeps generated CSS variables in parity with typed tokens", async () => {
  const cssUrl = new URL("../tokens.css", import.meta.url);
  const committedCss = await readFile(cssUrl, "utf8");

  assert.equal(committedCss, renderDesignTokenCss());
  assert.match(
    committedCss,
    new RegExp(
      `--mt-color-theme-dark-accent: ${designTokens.color.theme.dark.accent}`
    )
  );
  assert.match(
    committedCss,
    /--mt-color-background: var\(--mt-color-theme-dark-background\)/
  );
});
