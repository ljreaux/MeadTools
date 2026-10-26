import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Load the real Next/MDX/Sentry configuration in isolated processes. Do not run
// instrumentation, upload hooks, or a build: these checks send no Sentry events.
const inspectConfig = `
  import loadConfig from 'next/dist/server/config.js';
  import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';
  const config = await loadConfig.default(PHASE_PRODUCTION_BUILD, process.cwd());
  const rules = Object.keys(config.turbopack?.rules ?? {});
  console.log('BUILD_CONFIG_CHECK:' + JSON.stringify({
    enabled: config.env.NEXT_PUBLIC_SENTRY_ENABLED,
    mdx: rules.some(rule => rule.includes('mdx')),
    instrumentation: rules.some(rule => rule.includes('instrumentation')),
    sourceMaps: config.productionBrowserSourceMaps === true,
    debugIds: config.turbopack?.debugIds === true,
    uploadHook: typeof config.compiler?.runAfterProductionCompile === 'function',
  }));
`;

for (const environment of ["preview", "production"] as const) {
  test(`real Turbopack ${environment} configuration retains MDX and the correct Sentry setup`, () => {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", inspectConfig], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      encoding: "utf8",
      timeout: 30_000,
      env: {
        ...process.env,
        NODE_ENV: "production",
        VERCEL_ENV: environment,
        TURBOPACK: "1",
        NEXT_PUBLIC_SENTRY_ENABLED: "true",
        // Config inspection does not need or use upload credentials.
        SENTRY_AUTH_TOKEN: "",
      },
    });
    assert.equal(result.status, 0, "Next build configuration must load successfully");
    const line = result.stdout.split("\n").find(value => value.startsWith("BUILD_CONFIG_CHECK:"));
    assert.ok(line, "Configuration inspection must return its non-secret checks");
    const actual = JSON.parse(line.slice("BUILD_CONFIG_CHECK:".length));
    const production = environment === "production";
    assert.deepEqual(actual, {
      enabled: String(production),
      mdx: true,
      instrumentation: production,
      sourceMaps: production,
      debugIds: production,
      uploadHook: production,
    });
  });
}
