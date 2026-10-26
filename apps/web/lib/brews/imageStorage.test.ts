import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("R2 URLs expire after 60 seconds, prohibit caching and isolate deployments", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      fileURLToPath(new URL("./fixtures/imageStorage.mjs", import.meta.url)),
    ],
    {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        TSX_TSCONFIG_PATH: fileURLToPath(
          new URL("../../tsconfig.json", import.meta.url),
        ),
      },
      encoding: "utf8",
      timeout: 20_000,
    },
  );
  assert.equal(
    result.status,
    0,
    result.stderr || result.stdout || result.error?.message,
  );
});
