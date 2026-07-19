import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { getWeblateGermanComponents } from "./queue-weblate-review.mjs";

const WEBLATE_URL = process.env.WEBLATE_URL?.replace(/\/$/, "");
const WEBLATE_TOKEN = process.env.WEBLATE_APPROVAL_TOKEN;
const trustedReviewer = "rizzek";
const componentByFile = new Map([
  ["packages/i18n/locales/de/default.json", "default"],
  ["packages/i18n/locales/de/YeastTable.json", "yeast-table"],
]);

export function getApprovalCommit(body) {
  const match = body.trim().match(/^\/approve-translations\s+([0-9a-f]{7,40})$/i);
  return match?.[1] ?? null;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function flatten(value, prefix = "", entries = new Map()) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, entries));
    return entries;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, entries);
    }
    return entries;
  }

  entries.set(prefix, value);
  return entries;
}

function readJson(revision, file) {
  try {
    return JSON.parse(git("show", `${revision}:${file}`));
  } catch {
    return {};
  }
}

function targetMatches(candidate, target) {
  const currentTarget = Array.isArray(candidate.target)
    ? candidate.target[0]
    : candidate.target;
  return currentTarget === target;
}

async function commentOnIssue(event, body) {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) {
    throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required to acknowledge approval.");
  }

  const response = await fetch(
    `https://api.github.com/repos/${repository}/issues/${event.issue.number}/comments`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) {
    throw new Error(`Unable to acknowledge approval: ${response.status} ${await response.text()}`);
  }
}

async function main() {
  if (!WEBLATE_URL || !WEBLATE_TOKEN) {
    throw new Error("WEBLATE_URL and WEBLATE_APPROVAL_TOKEN are required.");
  }

  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const requestedCommit = getApprovalCommit(event.comment?.body ?? "");
  if (
    !requestedCommit ||
    event.issue?.pull_request ||
    event.comment?.user?.login !== trustedReviewer
  ) {
    console.log("Comment is not an eligible trusted translation approval.");
    return;
  }

  git("fetch", "origin", "preview");
  const commit = git("rev-parse", `${requestedCommit}^{commit}`);
  try {
    git("merge-base", "--is-ancestor", commit, "origin/preview");
  } catch {
    throw new Error(`${commit} is not contained in preview.`);
  }

  const parent = git("rev-parse", `${commit}^`);
  const changedFiles = git("diff", "--name-only", parent, commit)
    .split("\n")
    .filter(Boolean);
  const components = getWeblateGermanComponents(
    git("log", "-1", "--format=%B", commit),
    changedFiles,
  );
  if (components.length === 0) {
    throw new Error(`${commit} is not an isolated Weblate German translation commit.`);
  }

  const changedUnits = [];
  for (const file of changedFiles) {
    const previousEntries = flatten(readJson(parent, file));
    const currentEntries = flatten(readJson(commit, file));
    for (const [context, target] of currentEntries) {
      if (previousEntries.get(context) !== target) {
        changedUnits.push({ component: componentByFile.get(file), context, target });
      }
    }
  }
  if (changedUnits.length === 0) {
    throw new Error(`${commit} did not change any German translation values.`);
  }

  const headers = {
    Accept: "application/json",
    Authorization: `Token ${WEBLATE_TOKEN}`,
  };
  for (const { component, context, target } of changedUnits) {
    const query = new URLSearchParams({
      q: `component:${component} language:de context:${context}`,
      page_size: "10",
    });
    const lookup = await fetch(`${WEBLATE_URL}/api/units/?${query}`, { headers });
    if (!lookup.ok) {
      throw new Error(`Unable to find Weblate unit for ${component}:${context}.`);
    }
    const { results } = await lookup.json();
    const unit = results.find(
      (candidate) => candidate.context === context && targetMatches(candidate, target),
    );
    if (!unit) {
      throw new Error(
        `Weblate no longer has the expected current value for ${component}:${context}.`,
      );
    }
    const approval = await fetch(`${WEBLATE_URL}/api/units/${unit.id}/`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ state: 30 }),
    });
    if (!approval.ok) {
      throw new Error(`Unable to approve Weblate unit ${unit.id}.`);
    }
  }

  await commentOnIssue(
    event,
    `Approved ${changedUnits.length} Weblate German unit(s) from ${commit.slice(0, 7)}.`,
  );
  console.log(`Approved ${changedUnits.length} German Weblate unit(s).`);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await main();
}
