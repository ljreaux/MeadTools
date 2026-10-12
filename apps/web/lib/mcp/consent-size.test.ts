import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("accepted OAuth requests survive signed consent encoding and oversized POSTs are rejected", () => {
  const result = spawnSync(process.execPath, [
    "--conditions=react-server", "--import", "tsx",
    fileURLToPath(new URL("./fixtures/consent-size.mjs", import.meta.url)),
  ], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
      NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
      MCP_OAUTH_SIGNING_SECRET: "offline-fixture-signing-secret-at-least-32-chars",
      PREMIUM_MCP_ENABLED: "true",
      PREMIUM_ACCESS_ENABLED: "true",
      TSX_TSCONFIG_PATH: fileURLToPath(new URL("../../tsconfig.json", import.meta.url)),
    },
    encoding: "utf8", timeout: 20_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
});
