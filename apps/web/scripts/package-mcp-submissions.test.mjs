import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isMobileQualityAffected, readQualitySnapshot } from "../../../scripts/quality-impact.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));

test("web MCP packaging changes do not select Mobile quality", () => {
  // Impact discovery runs at the repository root in CI, while npm workspace
  // tests start in apps/web. Preserve that context without changing the helper.
  const previous = process.cwd();
  let snapshot;
  try {
    process.chdir(root);
    snapshot = readQualitySnapshot("HEAD");
  } finally {
    process.chdir(previous);
  }
  assert.equal(isMobileQualityAffected([
    "apps/web/package.json",
    "apps/web/scripts/package-mcp-submissions.mjs",
    "apps/web/scripts/package-mcp-submissions.test.mjs",
    "apps/web/components/account/McpGuide.tsx",
    "packages/i18n/locales/en/default.json",
    "packages/recipe-agent/src/index.ts"
  ], snapshot, snapshot), false);
  assert.equal(isMobileQualityAffected(["apps/mobile/package.json"], snapshot, snapshot), true);
});

test("MCP packages are reproducible across timezones and preserve distinct install formats", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "meadtools-package-test-"));
  try {
    const outputs = [path.join(temporary, "first"), path.join(temporary, "second")];
    for (const [index, output] of outputs.entries()) {
      execFileSync(process.execPath, ["apps/web/scripts/package-mcp-submissions.mjs", output, "--no-public"], {
        cwd: root,
        env: { ...process.env, TZ: index === 0 ? "UTC" : "America/Chicago" }
      });
    }
    const first = JSON.parse(await readFile(path.join(outputs[0], "inventory.json"), "utf8"));
    const second = JSON.parse(await readFile(path.join(outputs[1], "inventory.json"), "utf8"));
    assert.deepEqual(first, second);
    assert.equal(first.artifacts.length, 4);
    for (const artifact of first.artifacts) {
      assert.deepEqual(
        await readFile(path.join(outputs[0], artifact.name)),
        await readFile(path.join(outputs[1], artifact.name)),
        artifact.name
      );
    }
    const readEntry = (zip, file) => JSON.parse(execFileSync("unzip", [
      "-p", path.join(outputs[0], zip), file
    ], { encoding: "utf8" }));
    const claude = readEntry("meadtools-claude-0.1.0.zip", ".mcp.json");
    assert.deepEqual(claude.mcpServers.meadtools, { type: "http", url: "https://meadtools.com/mcp" });
    assert.equal(readEntry("meadtools-claude-0.1.0.zip", ".claude-plugin/plugin.json").name, "meadtools");
    const customer = readEntry("meadtools-chatgpt-0.1.0.zip", "plugin.json");
    assert.equal(customer.extensions["com.openai"].review, undefined);
    const review = readEntry("meadtools-chatgpt-0.1.0-draft.zip", "plugin.json");
    assert.equal(review.extensions["com.openai"].review.test_cases.positive.length, 5);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
