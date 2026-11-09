import { isMobileQualityAffected, readQualitySnapshot } from "./quality-impact.mjs";
import { existsSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const TARGETS = ["web", "mobile", "desktop"];

const APP_DIRECTORIES = {
  web: "apps/web/",
  mobile: "apps/mobile/",
  desktop: "apps/desktop/",
};

const SHARED_PATHS = [
  "packages/",
  "scripts/",
  "package.json",
  "tsconfig.base.json",
];

// Most translation-only commits do not need a new application build. German is
// bundled by every shipped app, though, so both Weblate follow-ups and human
// German review corrections must release an updated artifact.
const GENERATED_TRANSLATION_PATH = "packages/i18n/locales/";
const ENGLISH_TRANSLATION_PATH = "packages/i18n/locales/en/";
const GERMAN_TRANSLATION_PATH = "packages/i18n/locales/de/";
const WEBLATE_BATCH_MARKER = "Translation-Batch: weblate-auto";

// Dated release notes are published to production after verification, by a
// reviewed English-only publication PR to main (see the publication gate in
// monthly-release-window.mjs). Weblate only follows preview, so such a push
// must build Web itself; only Web renders release notes.
const RELEASE_NOTES_PATH = "packages/i18n/locales/en/default.json";
const DATED_RELEASE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const LOCKFILE = "package-lock.json";

// This deliberate, checked-in switch pauses all application builds while the
// translation-provider migration is being verified. Remove the marker once
// the migration is complete.
const MIGRATION_BUILD_PAUSE_MARKER = "ops/translation-migration.skip-builds";

const TARGET_CONFIGURATION = {
  web: ["vercel.json"],
  mobile: [],
  desktop: [],
};

function matchesPath(changedPath, candidate) {
  return candidate.endsWith("/")
    ? changedPath.startsWith(candidate)
    : changedPath === candidate;
}

export function isTargetAffected(target, changedPaths) {
  if (!TARGETS.includes(target)) {
    throw new Error(
      `Unknown target "${target}". Expected one of: ${TARGETS.join(", ")}.`,
    );
  }

  const relevantPaths = [
    APP_DIRECTORIES[target],
    ...SHARED_PATHS,
    ...TARGET_CONFIGURATION[target],
  ];

  return changedPaths.some(
    (changedPath) =>
      !changedPath.startsWith(GENERATED_TRANSLATION_PATH) &&
      relevantPaths.some((candidate) => matchesPath(changedPath, candidate)),
  );
}

export function classifyAppImpact(
  changedPaths,
  {
    buildsPaused = false,
    deferForWeblate = false,
    isWeblateTranslationBatch = false,
    publishesReleaseNotes = false,
  } = {},
) {
  if (buildsPaused) {
    return Object.fromEntries(TARGETS.map((target) => [target, false]));
  }

  if (isWeblateTranslationBatch) {
    // This is the one deployment/build released after a preview merge that
    // changed English. It includes both the source feature and Weblate's
    // generated German update.
    return Object.fromEntries(TARGETS.map((target) => [target, true]));
  }

  if (
    deferForWeblate &&
    // A PR preview may already have applied this migration to the shared
    // preview database. Deploy matching code before waiting for Weblate.
    !changedPaths.some((changedPath) =>
      changedPath.startsWith("apps/web/prisma/migrations/"),
    ) &&
    changedPaths.some((changedPath) =>
      changedPath.startsWith(ENGLISH_TRANSLATION_PATH),
    )
  ) {
    return Object.fromEntries(TARGETS.map((target) => [target, false]));
  }

  if (
    changedPaths.some((changedPath) =>
      changedPath.startsWith(GERMAN_TRANSLATION_PATH),
    )
  ) {
    return Object.fromEntries(TARGETS.map((target) => [target, true]));
  }

  const impact = Object.fromEntries(
    TARGETS.map((target) => [target, isTargetAffected(target, changedPaths)]),
  );

  if (publishesReleaseNotes && changedPaths.includes(RELEASE_NOTES_PATH)) {
    impact.web = true;
  }

  if (changedPaths.includes(LOCKFILE)) {
    const lockfileHasManifestContext = changedPaths.some(
      (changedPath) =>
        changedPath === "package.json" ||
        /^(?:apps|packages)\/[^/]+\/package\.json$/.test(changedPath),
    );

    if (!lockfileHasManifestContext) {
      return Object.fromEntries(TARGETS.map((target) => [target, true]));
    }
  }

  return impact;
}

export function isWeblateTranslationBatch(
  message,
  changedPaths,
  sourceChangedPaths = [],
) {
  const isGermanOnly =
    changedPaths.length > 0 &&
    changedPaths.every(
      (changedPath) =>
        changedPath.startsWith(GENERATED_TRANSLATION_PATH) &&
        !changedPath.startsWith(ENGLISH_TRANSLATION_PATH),
    );
  if (!isGermanOnly) return false;

  // Keep recognizing the migration-era marker, but native Weblate commits use
  // the normal component template. Their position directly after an English
  // source update is the reliable signal.
  return (
    message.includes(WEBLATE_BATCH_MARKER) ||
    sourceChangedPaths.some((changedPath) =>
      changedPath.startsWith(ENGLISH_TRANSLATION_PATH),
    )
  );
}

// True when the English release notes gain a dated entry. Edits to existing
// entries or to other English strings do not count.
export function addsDatedReleaseNoteEntry(beforeNotes, afterNotes) {
  const beforeEntries = beforeNotes?.releaseNotes?.entries ?? {};
  const afterEntries = afterNotes?.releaseNotes?.entries ?? {};
  return Object.keys(afterEntries).some(
    (key) => DATED_RELEASE_KEY.test(key) && !Object.hasOwn(beforeEntries, key),
  );
}

export function hasWeblateTranslationBatch(batches) {
  return batches.some(({ message, changedPaths, sourceChangedPaths }) =>
    isWeblateTranslationBatch(message, changedPaths, sourceChangedPaths),
  );
}

export function hasSkipWebCheckLabel(labels) {
  return labels.some(({ name }) => name === "skip-web-check");
}

export async function shouldSkipVercelWebPreview(
  {
    pullRequestId = process.env.VERCEL_GIT_PULL_REQUEST_ID,
    repositoryOwner = process.env.VERCEL_GIT_REPO_OWNER,
    repositorySlug = process.env.VERCEL_GIT_REPO_SLUG,
  } = {},
  request = fetch,
) {
  if (!pullRequestId || !repositoryOwner || !repositorySlug) return false;

  try {
    const response = await request(
      `https://api.github.com/repos/${repositoryOwner}/${repositorySlug}/issues/${pullRequestId}`,
      {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) return false;

    const issue = await response.json();
    return hasSkipWebCheckLabel(issue.labels || []);
  } catch {
    // If GitHub is unavailable, keep the safe default and build the preview.
    return false;
  }
}

export function readChangedPaths(base, head) {
  const result = spawnSync(
    "git",
    ["diff", "--no-renames", "--name-only", "--diff-filter=ACMRD", base, head],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to read changed paths.");
  }

  return result.stdout
    .split("\n")
    .map((changedPath) => changedPath.trim())
    .filter(Boolean);
}

function resolveRevisionRange() {
  const base =
    process.env.APP_IMPACT_BASE_SHA ||
    process.env.VERCEL_GIT_PREVIOUS_SHA ||
    "HEAD^";
  const head =
    process.env.APP_IMPACT_HEAD_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "HEAD";

  return { base, head };
}

function readCommitMessage(head) {
  const result = spawnSync("git", ["log", "-1", "--format=%B", head], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to read commit message.");
  }
  return result.stdout;
}

function readRevisionCommits(base, head) {
  const result = spawnSync(
    "git",
    ["rev-list", "--reverse", `${base}..${head}`],
    {
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to read revision commits.");
  }
  return result.stdout
    .split("\n")
    .map((commit) => commit.trim())
    .filter(Boolean);
}

function hasWeblateTranslationBatchInRange(base, head) {
  const batches = readRevisionCommits(base, head).map((commit) => {
    const parent = `${commit}^`;
    return {
      message: readCommitMessage(commit),
      changedPaths: readChangedPaths(parent, commit),
      sourceChangedPaths: readChangedPaths(`${commit}^^`, parent),
    };
  });
  return hasWeblateTranslationBatch(batches);
}

function readJsonAtRevision(revision, file) {
  const result = spawnSync("git", ["show", `${revision}:${file}`], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    // A missing file means there was no content at that revision.
    if (/does not exist|exists on disk, but not in/.test(result.stderr)) {
      return null;
    }
    throw new Error(result.stderr.trim() || `Unable to read ${file}.`);
  }
  return JSON.parse(result.stdout);
}

function publishesReleaseNotesInRange(base, head, changedPaths) {
  if (!changedPaths.includes(RELEASE_NOTES_PATH)) return false;
  return addsDatedReleaseNoteEntry(
    readJsonAtRevision(base, RELEASE_NOTES_PATH),
    readJsonAtRevision(head, RELEASE_NOTES_PATH),
  );
}

function isProductionBranch() {
  return (
    process.env.APP_IMPACT_PRODUCTION_BRANCH === "true" ||
    process.env.GITHUB_REF === "refs/heads/main" ||
    process.env.VERCEL_GIT_COMMIT_REF === "main"
  );
}

function isPreviewBranch() {
  return (
    process.env.APP_IMPACT_DEFER_FOR_WEBLATE === "true" ||
    process.env.GITHUB_REF === "refs/heads/preview" ||
    process.env.VERCEL_GIT_COMMIT_REF === "preview"
  );
}

async function run() {
  const githubOutput = process.argv.includes("--github-output");
  const target = process.argv.find((argument) => TARGETS.includes(argument));
  const { base, head } = resolveRevisionRange();

  let changedPaths;
  let impact;

  try {
    changedPaths = readChangedPaths(base, head);
    if (process.argv.includes("--quality")) {
      // Quality validates the source now, independently of release deferral.
      impact = classifyAppImpact(changedPaths);
      impact.mobile = isMobileQualityAffected(
        changedPaths, readQualitySnapshot(base), readQualitySnapshot(head),
      );
    } else {
      impact = classifyAppImpact(changedPaths, {
        buildsPaused: existsSync(MIGRATION_BUILD_PAUSE_MARKER),
        deferForWeblate: isPreviewBranch(),
        isWeblateTranslationBatch: hasWeblateTranslationBatchInRange(base, head),
        publishesReleaseNotes:
          isProductionBranch() &&
          !isPreviewBranch() &&
          publishesReleaseNotesInRange(base, head, changedPaths),
      });
    }

    if (target === "web" && (await shouldSkipVercelWebPreview())) {
      impact.web = false;
      console.log("Vercel preview skipped by the skip-web-check PR label.");
    }
  } catch (error) {
    console.warn(
      `Could not determine app impact for ${base}..${head}; running all checks as a safe fallback.`,
    );
    console.warn(error instanceof Error ? error.message : error);
    changedPaths = [];
    impact = Object.fromEntries(TARGETS.map((name) => [name, true]));
  }

  console.log(`Changed paths (${base}..${head}):`);
  console.log(
    changedPaths.length > 0 ? changedPaths.join("\n") : "(unknown or none)",
  );
  console.log(`App impact: ${JSON.stringify(impact)}`);
  if (existsSync(MIGRATION_BUILD_PAUSE_MARKER)) {
    console.log(
      `Application builds are paused by ${MIGRATION_BUILD_PAUSE_MARKER}.`,
    );
  }

  if (githubOutput) {
    if (!process.env.GITHUB_OUTPUT) {
      throw new Error("GITHUB_OUTPUT is required with --github-output.");
    }

    await appendFile(
      process.env.GITHUB_OUTPUT,
      `${TARGETS.map((name) => `${name}=${impact[name]}`).join("\n")}\n`,
    );
    return;
  }

  if (!target) {
    throw new Error(
      `Provide a target (${TARGETS.join(", ")}) or --github-output.`,
    );
  }

  // Vercel's ignoreCommand builds on exit 1 and skips on exit 0.
  process.exitCode = impact[target] ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
