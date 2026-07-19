import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const WEBLATE_URL = process.env.WEBLATE_URL?.replace(/\/$/, "");
const WEBLATE_TOKEN = process.env.WEBLATE_APPROVAL_TOKEN;
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const pullRequest = event.pull_request;
const approvalLabel = "translations-approved";
const trustedAuthor = "rizzek";
const componentByFile = new Map([
  ["packages/i18n/locales/de/default.json", "default"],
  ["packages/i18n/locales/de/YeastTable.json", "yeast-table"],
]);

if (!WEBLATE_URL || !WEBLATE_TOKEN) {
  throw new Error("WEBLATE_URL and WEBLATE_APPROVAL_TOKEN are required.");
}

const hasApprovalLabel = pullRequest.labels.some(
  ({ name }) => name === approvalLabel,
);
const isTrustedAuthor = pullRequest.user.login === trustedAuthor;

if (!pullRequest.merged || (!hasApprovalLabel && !isTrustedAuthor)) {
  console.log("PR is not eligible for automatic Weblate approval.");
  process.exit(0);
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

const after = git("rev-parse", "HEAD");
const before = git("rev-parse", "HEAD^");
const changedFiles = git("diff", "--name-only", before, after)
  .split("\n")
  .filter(Boolean);

const localeFiles = changedFiles.filter((file) => componentByFile.has(file));
const unexpectedFiles = changedFiles.filter((file) => !componentByFile.has(file));

if (localeFiles.length === 0) {
  console.log("Eligible PR has no German translation-file changes.");
  process.exit(0);
}

if (unexpectedFiles.length > 0) {
  throw new Error(
    `Refusing automatic approval because this PR also changes: ${unexpectedFiles.join(", ")}`,
  );
}

const changedUnits = [];
for (const file of localeFiles) {
  const previousEntries = flatten(readJson(before, file));
  const currentEntries = flatten(readJson(after, file));

  for (const [context, target] of currentEntries) {
    if (previousEntries.get(context) !== target) {
      changedUnits.push({ component: componentByFile.get(file), context, target });
    }
  }
}

if (changedUnits.length === 0) {
  console.log("No German translation values changed.");
  process.exit(0);
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

console.log(`Approved ${changedUnits.length} German Weblate unit(s).`);
