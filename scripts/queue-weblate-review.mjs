import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const reviewLabel = "translation-review";
const reviewIssueTitle = "German translation review queue";
const reviewer = "rizzek";
const componentByFile = new Map([
  ["packages/i18n/locales/de/default.json", "default"],
  ["packages/i18n/locales/de/YeastTable.json", "yeast-table"],
]);

// This is the commit contract the post-cutover translation bot will use. The
// marker keeps a normal German-only correction from being mistaken for an AI
// batch, while the file check prevents a mixed feature commit from qualifying.
export function getAiGermanComponents(message, changedFiles) {
  if (
    !/^chore\(l10n\): add German AI translations$/m.test(message) ||
    !/^Translation-Batch: ai-generated$/m.test(message)
  ) {
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

export function getAiTranslationBatches(base, head) {
  const mergeBase = git("merge-base", base, head);
  const commits = gitLines("rev-list", "--reverse", `${mergeBase}..${head}`);

  return commits.flatMap((commit) => {
    const parent = git("rev-parse", `${commit}^`);
    const changedFiles = gitLines("diff", "--name-only", parent, commit);
    const components = getAiGermanComponents(
      git("log", "-1", "--format=%B", commit),
      changedFiles,
    );

    return components.length > 0 ? [{ commit, components }] : [];
  });
}

function githubUrl(path) {
  return `https://api.github.com${path}`;
}

async function github(path, token, options = {}) {
  const response = await fetch(githubUrl(path), {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API ${options.method ?? "GET"} ${path} failed: ${response.status} ${await response.text()}`,
    );
  }

  return response.status === 204 ? null : response.json();
}

async function getIssueComments(owner, repository, issueNumber, token) {
  const comments = [];
  for (let page = 1; ; page += 1) {
    const response = await github(
      `/repos/${owner}/${repository}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
      token,
    );
    comments.push(...response);
    if (response.length < 100) {
      return comments;
    }
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
        description: "German AI translations awaiting review",
      }),
    });
  } catch (error) {
    if (!String(error).includes("422")) {
      throw error;
    }
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
  if (existing) {
    return existing;
  }

  const issue = await github(`/repos/${owner}/${repository}/issues`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: reviewIssueTitle,
      labels: [reviewLabel],
      body: [
        "This queue tracks AI-generated German translations that remain unapproved.",
        "",
        "Each batch below is pinned to its feature PR and exact bot commit. Review in Git or Weblate; do not use the latest `preview` commit as the review target.",
      ].join("\n"),
    }),
  });

  try {
    await github(
      `/repos/${owner}/${repository}/issues/${issue.number}/assignees`,
      token,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignees: [reviewer] }),
      },
    );
  } catch (error) {
    console.warn(
      `Created the review queue but could not assign ${reviewer}: ${error.message}`,
    );
  }

  return issue;
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
  const pullRequest = event.pull_request;
  if (
    !pullRequest?.merged ||
    pullRequest.base?.ref !== "preview" ||
    pullRequest.head?.repo?.full_name !== repositoryName
  ) {
    console.log("Pull request is not an eligible merged feature PR.");
    return;
  }

  const batches = getAiTranslationBatches(
    pullRequest.base.sha,
    pullRequest.head.sha,
  );
  if (batches.length === 0) {
    console.log("Feature PR has no isolated German AI translation batch.");
    return;
  }

  const [owner, repository] = repositoryName.split("/");
  await ensureLabel(owner, repository, token);
  const issue = await getOrCreateQueueIssue(owner, repository, token);
  const comments = await getIssueComments(
    owner,
    repository,
    issue.number,
    token,
  );

  for (const { commit, components } of batches) {
    const marker = `<!-- translation-review:pr-${pullRequest.number}:commit-${commit} -->`;
    if (comments.some((comment) => comment.body.includes(marker))) {
      console.log(`Review queue already contains ${commit}.`);
      continue;
    }

    const componentLinks = components
      .map((component) => {
        const query = new URLSearchParams({ q: "state:<approved" });
        return `- [${component} review queue](https://translations.meadtools.com/projects/meadtools-pilot/${component}/de/?${query})`;
      })
      .join("\n");
    const commitUrl = `https://github.com/${repositoryName}/commit/${commit}`;
    const body = [
      marker,
      "## New German AI translation batch",
      "",
      `- Feature PR: [#${pullRequest.number}](${pullRequest.html_url})`,
      `- Bot commit: [${commit.slice(0, 7)}](${commitUrl})`,
      `- Components: ${components.join(", ")}`,
      "- Status: generated and **unapproved**",
      "",
      componentLinks,
      "",
      `For corrections, open a German-only PR to \`preview\`; a merged trusted PR marks its changed units approved in Weblate. For an unchanged accepted suggestion, comment \`/approve-translations ${commit}\` on this issue.`,
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
      `Added AI translation batch ${commit} to issue #${issue.number}.`,
    );
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await main();
}
