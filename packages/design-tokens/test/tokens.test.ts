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

function relativeLuminance(color: string) {
  const match = /^hsl\(([\d.]+), ([\d.]+)%, ([\d.]+)%\)$/.exec(color);
  assert.ok(match, `expected an hsl() color, got ${color}`);
  const [h, s, l] = match.slice(1).map(Number);
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return lightness - chroma / 2 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const linear = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const [r, g, b] = [channel(0), channel(8), channel(4)].map(linear);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string) {
  const [light, dark] = [relativeLuminance(foreground), relativeLuminance(background)]
    .sort((a, b) => b - a);

  return (light + 0.05) / (dark + 0.05);
}

for (const [name, theme] of Object.entries(colorThemes)) {
  test(`native ${name} theme meets WCAG AA contrast on its backgrounds`, () => {
    for (const surface of [theme.background, theme.surface]) {
      for (const text of [theme.text, theme.textMuted, theme.error]) {
        assert.ok(
          contrastRatio(text, surface) >= 4.5,
          `${text} on ${surface} is ${contrastRatio(text, surface).toFixed(2)}:1`
        );
      }
      for (const mark of [theme.placeholder, theme.border, theme.accent, theme.success, theme.warning]) {
        assert.ok(
          contrastRatio(mark, surface) >= 3,
          `${mark} on ${surface} is ${contrastRatio(mark, surface).toFixed(2)}:1`
        );
      }
    }
    assert.ok(contrastRatio(theme.onAccent, theme.accent) >= 4.5);
  });
}
