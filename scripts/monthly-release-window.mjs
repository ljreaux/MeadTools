import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const context = "monthly-release-gate";
const repository = () => process.env.GITHUB_REPOSITORY;

export function isFirstMondayWindow(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return (
    parts.weekday === "Mon" &&
    Number(parts.day) <= 7 &&
    (Number(parts.hour) > 9 ||
      (Number(parts.hour) === 9 && Number(parts.minute) >= 15))
  );
}

export function releaseApproval(pr, mode, expectedHead) {
  const labels = new Set(pr.labels.map((label) => label.name));
  const body = pr.body ?? "";
  const head = body.match(/^Release-ready head:\s*([a-f0-9]{40})\s*$/im)?.[1];
  const base = body.match(/^Release-ready base:\s*([a-f0-9]{40})\s*$/im)?.[1];
  const build = body
    .match(/^Mobile production build:\s*(run|skip)\s*$/im)?.[1]
    ?.toLowerCase();
  if (
    pr.state !== "open" ||
    pr.draft ||
    pr.base.ref !== "main" ||
    (mode !== "hotfix" && pr.head.ref !== "preview") ||
    pr.head.repo.full_name !== repository()
  ) {
    return "Only an open, non-draft same-repository main PR can be armed.";
  }
  if (!labels.has("release-ready"))
    return "The release-ready label is missing.";
  if (labels.has("skip-web-check") || labels.has("skip-mobile-check")) {
    return "Quality-check skip labels are not allowed on an armed release PR.";
  }
  if (
    head !== pr.head.sha ||
    base !== pr.base.sha ||
    (expectedHead && expectedHead !== head)
  ) {
    return "The approved head/base SHA does not match the current PR.";
  }
  if (!build || labels.has("build-mobile-production") !== (build === "run")) {
    return "The Mobile build decision and build-mobile-production label disagree.";
  }
  if (mode === "initial" && !labels.has("initial-release-ready")) {
    return "The initial promotion needs the initial-release-ready label.";
  }
  if (
    mode === "hotfix" &&
    (!labels.has("hotfix-ready") || !labels.has("bug-fix-only"))
  ) {
    return "A hotfix needs hotfix-ready and bug-fix-only labels.";
  }
  if (mode === "monthly" && !pr.auto_merge)
    return "Native GitHub auto-merge is not armed.";
  return null;
}

function api(path, method = "GET", data) {
  const args = ["api", `repos/${repository()}/${path}`];
  if (method !== "GET") args.push("-X", method);
  if (data) args.push("--input", "-");
  return JSON.parse(
    execFileSync("gh", args, {
      encoding: "utf8",
      input: data ? JSON.stringify(data) : undefined,
    }),
  );
}

function postStatus(sha, state, description) {
  api(`statuses/${sha}`, "POST", { state, context, description });
}

function allChecksPassed(number) {
  const result = spawnSync(
    "gh",
    [
      "pr",
      "checks",
      String(number),
      "--repo",
      repository(),
      "--json",
      "name,bucket",
    ],
    {
      encoding: "utf8",
    },
  );
  if (!result.stdout)
    throw new Error(
      `Could not read checks for PR #${number}: ${result.stderr}`,
    );
  const checks = JSON.parse(result.stdout).filter(
    (check) => check.name !== context,
  );
  return (
    checks.some(
      (check) =>
        check.name === "Release notes or reviewed bug fix" &&
        check.bucket === "pass",
    ) &&
    checks.every(
      (check) => check.bucket === "pass" || check.bucket === "skipping",
    )
  );
}

async function openGate(number, mode, expectedHead) {
  const pr = api(`pulls/${number}`);
  const reason = releaseApproval(pr, mode, expectedHead);
  if (reason) {
    console.log(`PR #${number}: ${reason}`);
    return;
  }
  if (!allChecksPassed(number)) {
    console.log(
      `PR #${number}: CI or release-note checks are not all complete and passing.`,
    );
    return;
  }
  const latest = api(`pulls/${number}`);
  if (
    latest.head.sha !== pr.head.sha ||
    latest.base.sha !== pr.base.sha ||
    latest.body !== pr.body ||
    JSON.stringify(latest.labels.map(({ name }) => name).sort()) !==
      JSON.stringify(pr.labels.map(({ name }) => name).sort())
  ) {
    console.log(
      `PR #${number}: PR changed while checks were evaluated; gate remains closed.`,
    );
    return;
  }
  const changed = releaseApproval(latest, mode, expectedHead);
  if (changed) {
    console.log(`PR #${number}: approval changed during the check: ${changed}`);
    return;
  }
  postStatus(
    latest.head.sha,
    "success",
    `${mode} release approved for the exact reviewed commit`,
  );
  console.log(`PR #${number}: opened ${context} for ${latest.head.sha}.`);
}

async function main() {
  if (!repository() || !process.env.GH_TOKEN)
    throw new Error("GitHub repository and token are required.");
  if (process.env.GITHUB_EVENT_NAME === "pull_request") {
    const event = JSON.parse(
      await (
        await import("node:fs/promises")
      ).readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
    );
    if (event.pull_request.base.ref !== "main") return;
    postStatus(
      event.pull_request.head.sha,
      "pending",
      "Awaiting an approved release window",
    );
    console.log(`Held ${context} for ${event.pull_request.head.sha}.`);
    return;
  }

  const mode = process.env.RELEASE_MODE || "monthly";
  if (mode === "monthly" && !isFirstMondayWindow(new Date())) {
    console.log("Outside the first-Monday release window; no gate opened.");
    return;
  }
  if (mode !== "monthly" && mode !== "initial" && mode !== "hotfix") {
    throw new Error("Unknown release mode.");
  }
  if (
    mode !== "monthly" &&
    !/^[a-f0-9]{40}$/.test(process.env.RELEASE_EXPECTED_SHA ?? "")
  ) {
    throw new Error("Manual release requires the exact expected head SHA.");
  }
  const number = Number(process.env.RELEASE_PR_NUMBER);
  if (mode !== "monthly" && (!Number.isSafeInteger(number) || number <= 0)) {
    throw new Error("Manual release requires a PR number.");
  }
  if (mode === "monthly") {
    for (let page = 1; ; page++) {
      const prs = api(`pulls?state=open&base=main&per_page=100&page=${page}`);
      for (const pr of prs) {
        if (pr.labels.some((label) => label.name === "release-ready")) {
          await openGate(pr.number, mode);
        }
      }
      if (prs.length < 100) break;
    }
  } else {
    await openGate(number, mode, process.env.RELEASE_EXPECTED_SHA);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
