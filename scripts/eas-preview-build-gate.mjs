import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { classifyAppImpact } from "./app-impact.mjs";

const ENGLISH_LOCALE = "packages/i18n/locales/en/";
const GERMAN_LOCALE = "packages/i18n/locales/de/";
const BUILD_PAUSE_MARKER = new URL("../ops/translation-migration.skip-builds", import.meta.url);

export function shouldBuildMobilePreview(changedPaths, buildsPaused = false) {
  const hasEnglish = changedPaths.some((path) => path.startsWith(ENGLISH_LOCALE));
  const hasGerman = changedPaths.some((path) => path.startsWith(GERMAN_LOCALE));

  return classifyAppImpact(changedPaths, {
    buildsPaused,
    deferForWeblate: true,
    // A push containing both languages is already a complete translation batch.
    isWeblateTranslationBatch: hasEnglish && hasGerman
  }).mobile;
}

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed while checking the preview push`);
  }
  return result.stdout;
}

export function changedPathsForPush(before, head = "HEAD") {
  if (!/^[0-9a-f]{40}$/i.test(before) || /^0{40}$/.test(before)) {
    throw new Error("The preview push did not provide a valid previous commit");
  }

  // eas/checkout fetches only HEAD. Fetch the push's previous commit so the
  // diff covers every commit in the push rather than relying on missing HEAD^.
  git(["fetch", "--no-tags", "--depth=1", "origin", before]);
  return git(["diff", "--name-only", "--diff-filter=ACMRD", before, head])
    .split("\n")
    .filter(Boolean);
}

function main() {
  const buildsPaused = existsSync(BUILD_PAUSE_MARKER);
  if (buildsPaused) {
    process.stdout.write("false\n");
    return;
  }

  if (process.env.EAS_EVENT_NAME === "workflow_dispatch") {
    process.stdout.write("true\n");
    return;
  }

  // EAS does not always expose github.event.before to custom jobs. Without
  // the previous SHA, the diff cannot safely rule out Mobile changes, so run
  // the preview build instead of failing the gate and skipping every job.
  if (!/^[0-9a-f]{40}$/i.test(process.env.PUSH_BEFORE ?? "") ||
      /^0{40}$/.test(process.env.PUSH_BEFORE ?? "")) {
    process.stdout.write("true\n");
    return;
  }

  const changedPaths = changedPathsForPush(process.env.PUSH_BEFORE ?? "");
  process.stdout.write(`${shouldBuildMobilePreview(changedPaths)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    // An unavailable diff must not suppress all downstream preview jobs.
    process.stdout.write("true\n");
  }
}
