import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readChangedPaths } from "./app-impact.mjs";
import { isMobileQualityAffected, mobileWorkspaces, readQualitySnapshot } from "./quality-impact.mjs";

const snapshot = readQualitySnapshot();
test("revision snapshots read the full committed npm lockfile", () => {
  const committed = readQualitySnapshot("HEAD");
  assert.equal(committed.lock?.lockfileVersion, 3);
  assert.ok(committed.lock.packages["node_modules/expo"]);
});

const affected = (files, before = snapshot, after = snapshot) => isMobileQualityAffected(files, before, after);

test("original #466 feature paths do not require mobile quality", () => {
  // Original feature commit 5e7a8a4d1a8f0b631e4d812a5067492126f92b30,
  // before the unrelated Expo dependency fixes were added.
  assert.equal(affected([
    "apps/web/app/[locale]/recipe-draft/page.tsx",
    "apps/web/components/recipeBuilder/DraftRecipeBuilder.tsx",
    "apps/web/components/recipeBuilder/RecipeBuilder.tsx",
    "apps/web/components/recipeBuilder/SaveRecipe.tsx",
    "apps/web/lib/draft-handoff.test.ts", "apps/web/lib/draft-handoff.ts",
    "apps/web/lib/mcp/server.ts", "docs/mcp-recipe-draft-handoff.md",
    "packages/i18n/locales/en/default.json",
    "packages/recipe-agent/src/mcp-guidance.ts",
    "packages/recipe-workflows/package.json",
    "packages/recipe-workflows/src/draft-handoff.ts",
    "packages/recipe-workflows/src/index.ts",
    "packages/recipe-workflows/test/draft-handoff.test.ts",
  ]), false);
});

test("mobile direct and transitive workspace changes retain coverage", () => {
  assert.ok(mobileWorkspaces(snapshot).has("packages/credit-accounting"));
  for (const file of ["apps/mobile/app.config.ts", "apps/mobile/package.json", "packages/core/src/index.ts", "packages/i18n/src/resources.ts", "packages/api-client/src/index.ts", "packages/credit-accounting/src/index.ts"]) {
    assert.equal(affected([file]), true, file);
  }
  assert.equal(affected(["packages/recipe-agent/src/index.ts"]), false);
});

test("removed workspace edges are evaluated from both revisions", () => {
  const before = structuredClone(snapshot);
  before.manifests["apps/mobile"].dependencies["@meadtools/recipe-agent"] = "*";
  assert.equal(affected(["packages/recipe-agent/src/index.ts"], before), true);
});

test("tooling and unknown packages use conservative coverage", () => {
  for (const file of ["package.json", "tsconfig.base.json", "scripts/new-tool.mjs", ".github/workflows/quality.yml", ".npmrc", "packages/new-package/src/index.ts"]) assert.equal(affected([file]), true, file);
  assert.equal(affected(["docs/mobile.md"]), false);
  assert.equal(affected(["README.md"], { manifests: {} }), true);
});

test("lockfile compares the mobile dependency closure even alongside web manifests", () => {
  const before = structuredClone(snapshot);
  const after = structuredClone(snapshot);
  after.lock.packages["node_modules/expo"].version = "changed";
  assert.equal(affected(["apps/web/package.json", "package-lock.json"], before, after), true);
  const unrelated = structuredClone(snapshot);
  unrelated.lock.packages["node_modules/web-only-fixture"] = { version: "1.0.0" };
  assert.equal(affected(["apps/web/package.json", "package-lock.json"], before, unrelated), false);
  const malformed = structuredClone(snapshot);
  malformed.lock = {};
  assert.equal(affected(["package-lock.json"], before, malformed), true);
});

test("existing impact job gates all mobile validation and always tests classification", () => {
  const workflow = readFileSync(".github/workflows/quality.yml", "utf8");
  assert.match(workflow, /node scripts\/app-impact.mjs --quality --github-output/);
  assert.match(workflow, /node --test scripts\/app-impact.test.mjs scripts\/quality-impact.test.mjs/);
  const mobile = workflow.slice(workflow.indexOf("\n  mobile:"));
  assert.match(mobile, /needs: impact/);
  assert.match(mobile, /if: needs.impact.outputs.mobile == 'true'/);
  for (const command of ["mobile:typecheck", "npm test --workspace @meadtools/mobile", "expo install --check", "expo export --platform android"]) assert.ok(mobile.includes(command));
});


test("moving source out of a mobile workspace retains its deletion path", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "meadtools-impact-rename-"));
  const previous = process.cwd();
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    git("init");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.com");
    mkdirSync(path.join(directory, "packages/core/src"), { recursive: true });
    mkdirSync(path.join(directory, "packages/recipe-workflows/src"), { recursive: true });
    writeFileSync(path.join(directory, "packages/core/src/moved.ts"), "export const value = 1;\n");
    git("add", ".");
    git("commit", "-m", "base");
    renameSync(path.join(directory, "packages/core/src/moved.ts"), path.join(directory, "packages/recipe-workflows/src/moved.ts"));
    git("add", ".");
    git("commit", "-m", "move");
    process.chdir(directory);
    const files = readChangedPaths("HEAD^", "HEAD");
    assert.ok(files.includes("packages/core/src/moved.ts"));
    assert.equal(affected(files), true);
  } finally {
    process.chdir(previous);
    rmSync(directory, { recursive: true, force: true });
  }
});
