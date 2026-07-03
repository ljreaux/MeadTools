import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Next 16.0 bundles an older Browserslist snapshot that emits this warning
// itself, so updating or configuring the standalone mapping package cannot
// silence it. Preload a narrowly scoped filter in Next and its build workers.
const preloadPath = fileURLToPath(
  new URL("./suppress-baseline-browser-warning.cjs", import.meta.url)
);
const require = createRequire(import.meta.url);

require(preloadPath);
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, `--require=${preloadPath}`]
  .filter(Boolean)
  .join(" ");

await import("next/dist/bin/next");
