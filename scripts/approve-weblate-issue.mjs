import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  getIssueComments,
  getWeblateTranslationBatch,
  github,
} from "./queue-weblate-review.mjs";

const WEBLATE_URL = process.env.WEBLATE_URL?.replace(/\/$/, "");
const WEBLATE_TOKEN = process.env.WEBLATE_APPROVAL_TOKEN;
const trustedReviewers = new Set(["ljreaux", "rizzek"]);
const componentByFile = new Map([
  ["packages/i18n/locales/de/default.json", "default"],
  ["packages/i18n/locales/de/YeastTable.json", "yeast-table"],
]);

export function getIssueApprovalCommit(comment) {
  const match = comment.trim().match(/^\/approve-weblate\s+([a-f0-9]{7,40})$/i);
  return match?.[1].toLowerCase() ?? null;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitLines(...args) {
  const output = git(...args);
  return output ? output.split("\n").filter(Boolean) : [];
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

function isAncestor(commit, branch) {
  return (
    spawnSync("git", ["merge-base", "--is-ancestor", commit, branch]).status === 0
  );
}

function getChangedUnits(batch) {
  const changedFiles = gitLines("diff", "--name-only", batch.parent, batch.commit);
  const changedUnits = [];

  for (const file of changedFiles) {
    const component = componentByFile.get(file);
    if (!component) {
      throw new Error(`Batch includes an unexpected file: ${file}`);
    }

    const previousEntries = flatten(readJson(batch.parent, file));
    const currentEntries = flatten(readJson(batch.commit, file));
    for (const [context, target] of currentEntries) {
      if (previousEntries.get(context) !== target) {
        changedUnits.push({ component, context, target });
      }
    }
  }

  return changedUnits;
}

async function approveUnits(changedUnits) {
  const headers = {
    Accept: "application/json",
    Authorization: `Token ${WEBLATE_TOKEN}`,
  };

  for (const { component, context, target } of changedUnits) {
    const query = new URLSearchParams({
      q: `component:${component} language:de context:${context}`,
      page_size: "10",
    });
    const response = await fetch(`${WEBLATE_URL}/api/units/?${query}`, { headers });
    if (!response.ok) {
      throw new Error(`Unable to find Weblate unit for ${component}:${context}.`);
    }

    const { results } = await response.json();
    const unit = results.find(
      (candidate) => candidate.context === context && candidate.target?.[0] === target,
    );
    if (!unit) {
      throw new Error(
        `Weblate does not have the expected current value for ${component}:${context}.`,
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
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const repositoryName = process.env.GITHUB_REPOSITORY;
  if (!token || !eventPath || !repositoryName) {
    throw new Error(
      "GITHUB_TOKEN, GITHUB_EVENT_PATH, and GITHUB_REPOSITORY are required.",
    );
  }

  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const commitPrefix = getIssueApprovalCommit(event.comment.body);
  if (!commitPrefix || event.issue.pull_request) return;
  if (!trustedReviewers.has(event.comment.user.login)) {
    console.log(`Ignoring approval command from ${event.comment.user.login}.`);
    return;
  }
  if (!WEBLATE_URL || !WEBLATE_TOKEN) {
    throw new Error("WEBLATE_URL and WEBLATE_APPROVAL_TOKEN are required.");
  }

  const commit = git("rev-parse", `${commitPrefix}^{commit}`);
  if (!isAncestor(commit, "origin/preview")) {
    throw new Error(`Weblate batch ${commitPrefix} is not on preview.`);
  }

  const batch = getWeblateTranslationBatch(commit);
  if (!batch) {
    throw new Error(`${commitPrefix} is not an isolated Weblate German translation batch.`);
  }

  const [owner, repository] = repositoryName.split("/");
  const comments = await getIssueComments(owner, repository, event.issue.number, token);
  const queueMarker = `commit-${commit.slice(0, 7)}`;
  if (!comments.some((comment) => comment.body.includes(queueMarker))) {
    throw new Error(`This issue does not list Weblate batch ${commit.slice(0, 7)}.`);
  }

  const completionMarker = `<!-- translation-review-approved:commit-${commit} -->`;
  if (comments.some((comment) => comment.body.includes(completionMarker))) {
    console.log(`Weblate batch ${commit.slice(0, 7)} was already approved from this issue.`);
    return;
  }

  const changedUnits = getChangedUnits(batch);
  if (changedUnits.length === 0) {
    throw new Error(`Weblate batch ${commit.slice(0, 7)} has no changed German values.`);
  }

  await approveUnits(changedUnits);
  await github(
    `/repos/${owner}/${repository}/issues/${event.issue.number}/comments`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: [
          completionMarker,
          `Approved ${changedUnits.length} German Weblate unit(s) from [${commit.slice(0, 7)}](https://github.com/${repositoryName}/commit/${commit}) based on @${event.comment.user.login}'s no-op review command. No translation commit was created.`,
        ].join("\n\n"),
      }),
    },
  );
  console.log(`Approved ${changedUnits.length} German Weblate unit(s).`);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await main();
}
