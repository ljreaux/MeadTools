import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { branchSyncPlan } from "./sync-release-branches.mjs";

test("preview-ahead work is a no-op and divergent different files require review", () => {
  assert.equal(branchSyncPlan({ previewContainsMain: true, sameTree: false }), "unchanged");
  assert.equal(branchSyncPlan({ mainContainsPreview: true, sameTree: false }), "fast-forward-preview");
  assert.equal(branchSyncPlan({ sameTree: true }), "reconcile-preview");
  assert.equal(branchSyncPlan({ sameTree: false }), "review-required");
});

test("identical divergent trees reconcile into preview without modifying main; repeat is idempotent", () => {
  const root = mkdtempSync(join(tmpdir(), "meadtools-sync-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  try {
    git("init", "--initial-branch=fixture-base"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
    writeFileSync(join(root, "file"), "same\n"); git("add", "."); git("commit", "-m", "base");
    git("branch", "main"); git("branch", "preview");
    git("checkout", "main"); git("commit", "--allow-empty", "-m", "production publication");
    const main = git("rev-parse", "main");
    git("checkout", "preview"); git("commit", "--allow-empty", "-m", "preview reconciliation");
    const preview = git("rev-parse", "preview");
    git("init", "--bare", "remote.git"); git("remote", "add", "origin", join(root, "remote.git"));
    git("push", "origin", "main", "preview");
    const run = () => execFileSync(process.execPath, [fileURLToPath(new URL("./sync-release-branches.mjs", import.meta.url))], { cwd: root, stdio: "pipe" });
    run();
    const merged = git("rev-parse", "refs/remotes/origin/preview");
    assert.equal(git("rev-parse", "refs/remotes/origin/main"), main);
    assert.equal(git("show", "-s", "--format=%P", merged), `${preview} ${main}`);
    assert.equal(git("rev-parse", `${merged}^{tree}`), git("rev-parse", `${main}^{tree}`));
    run(); assert.equal(git("rev-parse", "refs/remotes/origin/preview"), merged);
    git("checkout", "main"); writeFileSync(join(root, "file"), "production changed\n");
    git("add", "file"); git("commit", "-m", "new production content"); git("push", "origin", "main");
    assert.throws(run, /Command failed/);
    assert.equal(git("rev-parse", "refs/remotes/origin/preview"), merged);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the active Vercel config schedules cleanup and agrees with the app config", () => {
  const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
  const root = read("../vercel.json");
  assert.deepEqual(root.crons.filter(({ path }) => path === "/api/cron/cleanup-brew-images"), [
    { path: "/api/cron/cleanup-brew-images", schedule: "*/15 * * * *" },
  ]);
  assert.deepEqual(root.crons, read("../apps/web/vercel.json").crons);
});
