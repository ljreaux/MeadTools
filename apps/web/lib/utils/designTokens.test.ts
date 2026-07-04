import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { webColorChannels } from "@meadtools/design-tokens";
import { kebabCase } from "@meadtools/design-tokens/css-runtime";

test("maps every established web theme value to its shared token", async () => {
  const globalsUrl = new URL("../../app/globals.css", import.meta.url);
  const globals = await readFile(globalsUrl, "utf8");

  for (const [theme, colors] of Object.entries(webColorChannels)) {
    for (const name of Object.keys(colors)) {
      const cssName = kebabCase(name);
      assert.match(
        globals,
        new RegExp(
          `--${cssName}: var\\(--mt-web-${theme}-${cssName}\\)`
        )
      );
    }
  }

  assert.match(globals, /--radius: var\(--mt-web-radius\)/);
});
