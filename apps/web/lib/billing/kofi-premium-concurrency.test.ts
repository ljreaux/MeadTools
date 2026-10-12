import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("overlapping Ko-fi payments preserve the latest expiry and one monthly allowance", () => {
  const result = spawnSync(process.execPath, [
    "--conditions=react-server", "--import", "tsx",
    fileURLToPath(new URL("./fixtures/kofi-premium-concurrency.mjs", import.meta.url)),
  ], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
      KOFI_EMAIL_DIGEST_SECRET: "offline-fixture",
      TSX_TSCONFIG_PATH: fileURLToPath(new URL("../../tsconfig.json", import.meta.url)),
    },
    encoding: "utf8", timeout: 20_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
});
