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
  "package-lock.json",
  "tsconfig.base.json",
];

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

  return changedPaths.some((changedPath) =>
    relevantPaths.some((candidate) => matchesPath(changedPath, candidate)),
  );
}

export function classifyAppImpact(changedPaths) {
  return Object.fromEntries(
    TARGETS.map((target) => [
      target,
      isTargetAffected(target, changedPaths),
    ]),
  );
}

function readChangedPaths(base, head) {
  const result = spawnSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMRD", base, head],
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

async function run() {
  const githubOutput = process.argv.includes("--github-output");
  const target = process.argv.find((argument) => TARGETS.includes(argument));
  const { base, head } = resolveRevisionRange();

  let changedPaths;
  let impact;

  try {
    changedPaths = readChangedPaths(base, head);
    impact = classifyAppImpact(changedPaths);
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
