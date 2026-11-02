import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("production webhook handlers reject stale state and use verified invoice periods with mocked services", () => {
  const result = spawnSync(process.execPath, [
    "--conditions=react-server", "--import", "tsx",
    fileURLToPath(new URL("./fixtures/stripe-premium-handlers.mjs", import.meta.url)),
  ], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
      STRIPE_SECRET_KEY: "sk_test_offline_fixture",
      STRIPE_PREMIUM_PRICE_ID: "price_premium",
      TSX_TSCONFIG_PATH: fileURLToPath(new URL("../../tsconfig.json", import.meta.url)),
    },
    encoding: "utf8", timeout: 20_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
});
