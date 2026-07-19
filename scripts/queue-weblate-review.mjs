import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const reviewLabel = "translation-review";
const reviewIssueTitle = "German translation review queue";
const reviewer = "rizzek";
const componentByFile = new Map([
  ["packages/i18n/locales/de/default.json", "default"],
  ["packages/i18n/locales/de/YeastTable.json", "yeast-table"],
]);

export function getWeblateGermanComponents(message, changedFiles) {
  if (!/^chore\(l10n\): update German translation$/m.test(message)) {
    return [];
  }

  if (
    changedFiles.length === 0 ||
    changedFiles.some((file) => !componentByFile.has(file))
  ) {
    return [];
  }

  const components = changedFiles.map((file) => componentByFile.get(file));
  const declaredComponents = [...message.matchAll(
    /^Translation: MeadTools pilot\/([^\s]+)$/gm,
  )].map(([, component]) => component);

  return components.every((component) => declaredComponents.includes(component))
    ? [...new Set(components)]
    : [];
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
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
        "Review the batch links below. Make corrections in a German-only PR to `preview`, or approve a correct suggestion in Weblate.",
        "",
        "Do not use the latest `preview` commit as the review target; use the pinned commit link for each batch.",
      ].join("\n"),
    }),
  });

  try {
    await github(`/repos/${owner}/${repository}/issues/${issue.number}/assignees`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignees: [reviewer] }),
    });
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
    throw new Error("GITHUB_TOKEN, GITHUB_EVENT_PATH, and GITHUB_REPOSITORY are required.");
  }

  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  if (event.ref !== "refs/heads/preview" || !event.head_commit) {
    console.log("Push is not a preview commit.");
    return;
  }

  const changedFiles = git("diff", "--name-only", event.before, event.after)
    .split("\n")
    .filter(Boolean);
  const components = getWeblateGermanComponents(
    event.head_commit.message,
    changedFiles,
  );
  if (components.length === 0) {
    console.log("Push is not an isolated Weblate German translation commit.");
    return;
  }

  const [owner, repository] = repositoryName.split("/");
  await ensureLabel(owner, repository, token);
  const issue = await getOrCreateQueueIssue(owner, repository, token);
  const marker = `<!-- weblate-review:${event.after} -->`;
  const comments = await github(
    `/repos/${owner}/${repository}/issues/${issue.number}/comments?per_page=100`,
    token,
  );
  if (comments.some((comment) => comment.body.includes(marker))) {
    console.log(`Review queue already contains ${event.after}.`);
    return;
  }

  const componentLinks = components
    .map((component) => {
      const query = new URLSearchParams({ q: "state:<approved" });
      return `- [${component} review queue](https://translations.meadtools.com/projects/meadtools-pilot/${component}/de/?${query})`;
    })
    .join("\n");
  const commitUrl = `https://github.com/${repositoryName}/commit/${event.after}`;
  const body = [
    marker,
    "## New German AI translation batch",
    "",
    `- Commit: [${event.after.slice(0, 7)}](${commitUrl})`,
    `- Components: ${components.join(", ")}`,
    "- Status: generated and **unapproved**",
    "",
    componentLinks,
    "",
    `To review in Git, branch from [this commit](${commitUrl}), edit only the German locale files, and open a PR to \`preview\`. A merged PR from @${reviewer} marks the changed units approved in Weblate.`,
    "",
    "For an unchanged suggestion, approve it in Weblate. The planned trusted `/approve-translations` issue command will provide a GitHub-only alternative.",
  ].join("\n");
  await github(`/repos/${owner}/${repository}/issues/${issue.number}/comments`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });

  console.log(`Added Weblate translation batch ${event.after} to issue #${issue.number}.`);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await main();
}
