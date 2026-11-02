import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import postcss from "postcss";
import { DESIGN_THEMES, DEFAULT_DESIGN_THEME, DESIGN_THEME_STORAGE_KEY, designThemeInitScript } from "./design-themes";

test("design startup only applies a known saved design and tolerates unavailable storage", () => {
  for (const saved of [null, "unknown", ...DESIGN_THEMES.map(({ id }) => id)]) {
    let applied: string = DEFAULT_DESIGN_THEME;
    let readKey: string | undefined;
    let writes = 0;
    runInNewContext(designThemeInitScript, {
      localStorage: {
        getItem(key: string) {
          readKey = key;
          return saved;
        },
        setItem() { writes++; },
      },
      document: { documentElement: { setAttribute(key: string, value: string) {
        assert.equal(key, "data-design");
        applied = value;
      } } },
    });
    assert.equal(readKey, DESIGN_THEME_STORAGE_KEY);
    assert.equal(writes, 0, "Startup must not write preferences");
    assert.equal(applied, DESIGN_THEMES.some(({ id }) => id === saved) ? saved : DEFAULT_DESIGN_THEME);
  }
  // No document access is needed when localStorage is blocked.
  assert.doesNotThrow(() => runInNewContext(designThemeInitScript, {
    localStorage: { getItem() { throw new Error("Storage blocked"); } },
  }));
});

const colorTokens = [
  "background", "foreground", "card", "card-foreground", "popover",
  "popover-foreground", "primary", "primary-foreground", "secondary",
  "secondary-foreground", "muted", "muted-foreground", "accent",
  "accent-foreground", "destructive", "destructive-foreground", "warning",
  "warning-foreground", "border", "input", "ring",
  ...Array.from({ length: 5 }, (_, i) => `chart-${i + 1}`),
];

// Keep the contributor artwork while preventing theme-specific density changes.
for (const { id } of DESIGN_THEMES.filter(({ id }) => id !== "classic")) {
  test(`${id} supplies both palettes without changing component layout`, async () => {
    const css = postcss.parse(await readFile(
      new URL(`../app/themes/${id}.css`, import.meta.url), "utf8",
    ));
    const palettes = new Map<string, Map<string, string>>();
    css.walkRules((rule) => {
      assert.ok(!rule.selector.includes("page-panel"), "Page surfaces must not need per-page hooks");
      const decoration = postcss.list.comma(rule.selector).every((selector) => /::(?:before|after)/.test(selector));
      const keyframe = rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name);
      if (!decoration && !keyframe) {
        rule.walkDecls((decl) => {
          assert.ok(!/^(?:(?:padding|margin)(?:-.+)?|gap|row-gap|column-gap|width|height|min-width|max-width|min-height|max-height|font-size|line-height|letter-spacing|display|flex(?:-.+)?|grid(?:-.+)?)$/.test(decl.prop), `${rule.selector} changes ${decl.prop}`);
        });
      }
      if ([`html[data-design="${id}"]`, `html.dark[data-design="${id}"]`].includes(rule.selector)) {
        const tokens = palettes.get(rule.selector) ?? new Map<string, string>();
        rule.walkDecls((decl) => {
          if (decl.prop.startsWith("--")) tokens.set(decl.prop, decl.value);
        });
        palettes.set(rule.selector, tokens);
      }
    });
    assert.equal(palettes.size, 2);
    const light = palettes.get(`html[data-design="${id}"]`)!;
    const dark = palettes.get(`html.dark[data-design="${id}"]`)!;
    for (const tokens of [light, dark]) {
      for (const name of colorTokens) assert.ok(tokens.has(`--${name}`), `Missing --${name}`);
    }
    assert.ok(light.has("--radius"));
    for (const tokens of [light, new Map([...light, ...dark])]) {
      for (const value of tokens.values()) {
        for (const [, reference] of value.matchAll(/var\((--[\w-]+)/g)) {
          // next/font supplies font variables on the same html element.
          assert.ok(tokens.has(reference) || reference.startsWith("--font-"), `Missing ${reference}`);
        }
      }
    }
  });
}
