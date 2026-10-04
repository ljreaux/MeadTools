import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { shouldBuildMobilePreview } from "./eas-preview-build-gate.mjs";

const gateScript = fileURLToPath(new URL("./eas-preview-build-gate.mjs", import.meta.url));

function command(cwd, executable, args, env = process.env) {
  const result = spawnSync(executable, args, { cwd, env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test("mobile preview waits for English, then builds the German follow-up", () => {
  assert.equal(shouldBuildMobilePreview(["packages/i18n/locales/en/default.json"]), false);
  assert.equal(shouldBuildMobilePreview(["packages/i18n/locales/de/default.json"]), true);
  assert.equal(shouldBuildMobilePreview(["packages/i18n/locales/lt/default.json"]), false);
  assert.equal(shouldBuildMobilePreview(["apps/mobile/src/app/index.tsx"]), true);
  assert.equal(shouldBuildMobilePreview(["apps/mobile/src/app/index.tsx"], true), false);
});

test("mobile preview gate reads the full push from an EAS-style shallow checkout", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "meadtools-eas-gate-"));
  const remote = path.join(root, "remote.git");
  const writer = path.join(root, "writer");
  const checkout = path.join(root, "checkout");

  try {
    command(root, "git", ["init", "--bare", remote]);
    command(root, "git", ["clone", remote, writer]);
    command(writer, "git", ["config", "user.name", "Test"]);
    command(writer, "git", ["config", "user.email", "test@example.com"]);
    writeFileSync(path.join(writer, "README.md"), "Initial\n");
    command(writer, "git", ["add", "."]);
    command(writer, "git", ["commit", "-m", "initial"]);
    command(writer, "git", ["branch", "-M", "preview"]);
    command(writer, "git", ["push", "-u", "origin", "preview"]);
    const beforeEnglish = command(writer, "git", ["rev-parse", "HEAD"]);

    const locale = path.join(writer, "packages/i18n/locales");
    mkdirSync(path.join(locale, "en"), { recursive: true });
    writeFileSync(path.join(locale, "en/default.json"), "{}\n");
    command(writer, "git", ["add", "."]);
    command(writer, "git", ["commit", "-m", "English mobile strings"]);
    command(writer, "git", ["push"]);
    const beforeGerman = command(writer, "git", ["rev-parse", "HEAD"]);

    command(root, "git", ["clone", "--depth=1", "--branch", "preview", `file://${remote}`, checkout]);
    assert.equal(command(checkout, "git", ["rev-parse", "--is-shallow-repository"]), "true");
    const englishGate = command(checkout, process.execPath, [gateScript], {
      ...process.env,
      EAS_EVENT_NAME: "push",
      PUSH_BEFORE: beforeEnglish
    });
    assert.equal(englishGate, "false");

    mkdirSync(path.join(locale, "de"), { recursive: true });
    writeFileSync(path.join(locale, "de/default.json"), "{}\n");
    command(writer, "git", ["add", "."]);
    command(writer, "git", ["commit", "-m", "chore(l10n): update German translation"]);
    command(writer, "git", ["push"]);
    command(checkout, "git", ["fetch", "--depth=1", "origin", "preview"]);
    command(checkout, "git", ["checkout", "--detach", "FETCH_HEAD"]);
    const germanGate = command(checkout, process.execPath, [gateScript], {
      ...process.env,
      EAS_EVENT_NAME: "push",
      PUSH_BEFORE: beforeGerman
    });
    assert.equal(germanGate, "true");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
