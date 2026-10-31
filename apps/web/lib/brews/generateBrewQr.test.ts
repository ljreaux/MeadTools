import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("QR server action authenticates and enforces current ownership, entitlement, account and rollout state", () => {
  const result = spawnSync(process.execPath, [
    "--conditions=react-server", "--import", "tsx",
    fileURLToPath(new URL("./fixtures/generateBrewQr.mjs", import.meta.url)),
  ], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
      ACCESS_TOKEN_SECRET: "offline-qr-fixture-secret",
      PREMIUM_ACCESS_ENABLED: "true",
      NEXT_PUBLIC_BASE_URL: "https://qr-fixture.meadtools.com/",
      TSX_TSCONFIG_PATH: fileURLToPath(new URL("../../tsconfig.json", import.meta.url)),
    },
    encoding: "utf8", timeout: 20_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
});
