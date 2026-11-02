import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

// Exercise the configured CLI's imports, stopping at the reset guard before DB access.
test("seed command loads server modules and retains the destructive reset guard", () => {
  const config = readFileSync(new URL("../prisma.config.ts", import.meta.url), "utf8");
  const command = config.match(/seed: "([^"]+)"/)?.[1];
  assert.ok(command);
  const [executable, ...args] = command.split(" ");
  const result = spawnSync(executable, args, {
    cwd: new URL("../", import.meta.url), encoding: "utf8", timeout: 15_000,
    env: { ...process.env, NODE_ENV: "test", ALLOW_DB_RESET: "false",
      DATABASE_URL: "postgresql://seed_guard@localhost:1/seed_guard",
      DATABASE_DIRECT_URL: "postgresql://seed_guard@localhost:1/seed_guard" },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to run: set ALLOW_DB_RESET=/);
  assert.doesNotMatch(result.stderr, /cannot be imported from a Client Component/);
});
