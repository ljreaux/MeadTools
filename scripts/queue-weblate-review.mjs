import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const reviewLabel = "translation-review";
const reviewIssueTitle = "German translation review queue";
const reviewer = "rizzek";
const fallbackReviewer = "ljreaux";
const componentByFile = new Map([
  ["packages/i18n/locales/de/default.json", "default"],
  ["packages/i18n/locales/de/YeastTable.json", "yeast-table"],
]);

// Weblate writes this trailer into automatic-translation commits. The file
// check prevents an unrelated commit from being added to the review queue.
export function getWeblateGermanComponents(message, changedFiles) {
  if (!/^Translation-Batch: weblate-auto$/m.test(message)) {
    return [];
  }

  if (
    changedFiles.length === 0 ||
    changedFiles.some((file) => !componentByFile.has(file))
  ) {
    return [];
  }

  return [...new Set(changedFiles.map((file) => componentByFile.get(file)))];
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitLines(...args) {
  const output = git(...args);
  return output ? output.split("\n").filter(Boolean) : [];
}

export function getWeblateTranslationBatch(commit = "HEAD") {
  const parent = git("rev-parse", `${commit}^`);
  const changedFiles = gitLines("diff", "--name-only", parent, commit);
  const components = getWeblateGermanComponents(
    git("log", "-1", "--format=%B", commit),
    changedFiles,
  );

  return components.length > 0 ? { commit, parent, components } : null;
}

export function getWeblateTranslationBatches(before, after) {
  return gitLines("rev-list", "--reverse", `${before}..${after}`)
    .map((commit) => getWeblateTranslationBatch(commit))
    .filter(Boolean);
}

function getSourceCommit(commit) {
  let sourceCommit = git("rev-parse", `${commit}^`);
  while (getWeblateTranslationBatch(sourceCommit)) {
    sourceCommit = git("rev-parse", `${sourceCommit}^`);
  }
  return sourceCommit;
}

function githubUrl(path) {
  return `https://api.github.com${path}`;
}

const retryableGithubStatuses = new Set([429, 500, 502, 503, 504]);
const githubRequestAttempts = 4;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function github(path, token, options = {}) {
  for (let attempt = 1; attempt <= githubRequestAttempts; attempt += 1) {
    const response = await fetch(githubUrl(path), {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers ?? {}),
      },
    });

    if (response.ok) {
      return response.status === 204 ? null : response.json();
    }

    const body = await response.text();
    if (
      !retryableGithubStatuses.has(response.status) ||
      attempt === githubRequestAttempts
    ) {
      throw new Error(
        `GitHub API ${options.method ?? "GET"} ${path} failed: ${response.status} ${body}`,
      );
    }

    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : 500 * 2 ** (attempt - 1);
    console.warn(
      `GitHub API ${options.method ?? "GET"} ${path} returned ${response.status}; retrying in ${delay}ms (${attempt}/${githubRequestAttempts}).`,
    );
    await wait(delay);
  }

  throw new Error("GitHub request retry loop exited unexpectedly.");
}

async function getIssueComments(owner, repository, issueNumber, token) {
  const comments = [];
  for (let page = 1; ; page += 1) {
    const response = await github(
      `/repos/${owner}/${repository}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
      token,
    );
    comments.push(...response);
    if (response.length < 100) return comments;
  }
}

async function ensureLabel(owner, repository, token) {
  try {
    await github(`/repos/${owner}/${repository}/labels`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: reviewLabel,
        color: "5319E7",
        description: "German Weblate translations awaiting review",
      }),
    });
  } catch (error) {
    if (!String(error).includes("422")) throw error;
  }
}

async function assignQueueReviewer(owner, repository, issueNumber, token) {
  const assigneePath = `/repos/${owner}/${repository}/issues/${issueNumber}/assignees`;
  try {
    await github(assigneePath, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignees: [reviewer] }),
    });
    await github(assigneePath, token, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignees: [fallbackReviewer] }),
    });
    console.log(`Assigned the translation review queue to ${reviewer}.`);
  } catch {
    console.warn(
      `Could not assign ${reviewer}; assigning ${fallbackReviewer} until they accept repository access.`,
    );
    await github(assigneePath, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignees: [fallbackReviewer] }),
    });
  }
}

async function getOrCreateQueueIssue(owner, repository, token) {
  const issues = await github(
    `/repos/${owner}/${repository}/issues?state=open&labels=${encodeURIComponent(reviewLabel)}&per_page=100`,
    token,
  );
  const existing = issues.find(
    (issue) => !issue.pull_request && issue.title === reviewIssueTitle,
  );
  if (existing) return existing;

  return github(`/repos/${owner}/${repository}/issues`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: reviewIssueTitle,
      labels: [reviewLabel],
      body: [
        "This queue tracks Weblate-generated German translations that need review.",
        "",
        "Each batch below is pinned to the source feature PR when GitHub can identify it, plus the exact Weblate commit. Review in Git or Weblate; do not use the latest `preview` commit as the review target.",
      ].join("\n"),
    }),
  });
}

async function getSourcePullRequest(owner, repository, commit, token) {
  const pullRequests = await github(
    `/repos/${owner}/${repository}/commits/${commit}/pulls?per_page=100`,
    token,
  );
  return pullRequests.find(
    (pullRequest) =>
      pullRequest.merged_at && pullRequest.base?.ref === "preview",
  );
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
  if (event.ref !== "refs/heads/preview" || !event.after || /^0+$/.test(event.after)) {
    console.log("Push is not an eligible update to preview.");
    return;
  }

  const batches = getWeblateTranslationBatches(event.before, event.after);
  if (batches.length === 0) {
    console.log("Push has no isolated Weblate German translation batch.");
    return;
  }

  const [owner, repository] = repositoryName.split("/");
  await ensureLabel(owner, repository, token);
  const issue = await getOrCreateQueueIssue(owner, repository, token);
  await assignQueueReviewer(owner, repository, issue.number, token);
  const comments = await getIssueComments(owner, repository, issue.number, token);
  const sourcePullRequests = new Map();
  for (const batch of batches) {
    const sourceCommit = getSourceCommit(batch.commit);
    const marker = `<!-- translation-review:source-${sourceCommit}:commit-${batch.commit} -->`;
    if (comments.some((comment) => comment.body.includes(marker))) {
      console.log(`Review queue already contains ${batch.commit}.`);
      continue;
    }

    if (!sourcePullRequests.has(sourceCommit)) {
      sourcePullRequests.set(
        sourceCommit,
        await getSourcePullRequest(owner, repository, sourceCommit, token),
      );
    }
    const sourcePullRequest = sourcePullRequests.get(sourceCommit);
    const componentLinks = batch.components
      .map((component) => {
        const query = new URLSearchParams({ q: "state:<approved" });
        return `- [${component} review queue](https://translations.meadtools.com/projects/meadtools-pilot/${component}/de/?${query})`;
      })
      .join("\n");
    const sourceCommitUrl = `https://github.com/${repositoryName}/commit/${sourceCommit}`;
    const commitUrl = `https://github.com/${repositoryName}/commit/${batch.commit}`;
    const sourceReference = sourcePullRequest
      ? `- Source feature PR: [#${sourcePullRequest.number}](${sourcePullRequest.html_url})`
      : `- Source commit: [${sourceCommit.slice(0, 7)}](${sourceCommitUrl})`;
    const body = [
      marker,
      "## New German Weblate translation batch",
      "",
      sourceReference,
      `- Weblate commit: [${batch.commit.slice(0, 7)}](${commitUrl})`,
      `- Components: ${batch.components.join(", ")}`,
      "- Status: automatically translated and **needs review**",
      "",
      componentLinks,
      "",
      "For corrections, open a German-only PR to `preview`; a merged trusted PR marks its changed units approved in Weblate. For an unchanged suggestion, approve it directly in Weblate.",
    ].join("\n");
    await github(
      `/repos/${owner}/${repository}/issues/${issue.number}/comments`,
      token,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      },
    );
    console.log(
      `Added Weblate translation batch ${batch.commit} to issue #${issue.number}.`,
    );
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await main();
}
