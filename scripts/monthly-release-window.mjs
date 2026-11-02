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
    Number(parts.hour) < 12 &&
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

export function releaseChecksPassed(checks) {
  const blocking = checks.filter(
    (check) =>
      check.name !== context &&
      check.name !== "Hold or open monthly release gate" &&
      // Expo preview jobs can wait in a long queue even when Mobile's
      // separate production build decision is skip.
      !check.name.startsWith("Create Preview Builds /"),
  );
  return (
    blocking.some(
      (check) =>
        check.name === "Release notes or reviewed bug fix" &&
        check.bucket === "pass",
    ) &&
    blocking.every(
      (check) => check.bucket === "pass" || check.bucket === "skipping",
    )
  );
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
  return releaseChecksPassed(JSON.parse(result.stdout));
}

export function releaseReviewPassed(decision) {
  // Empty means GitHub requires no review; the maintainer's SHA-bound
  // release-ready authorization is still mandatory. Unknown is not approval.
  return decision === "APPROVED" || decision === "";
}

function reviewPassed(number) {
  const decision = execFileSync(
    "gh",
    [
      "pr",
      "view",
      String(number),
      "--repo",
      repository(),
      "--json",
      "reviewDecision",
      "--jq",
      ".reviewDecision",
    ],
    { encoding: "utf8" },
  ).trim();
  return releaseReviewPassed(decision);
}

function openMainPRs() {
  const result = [];
  for (let page = 1; ; page++) {
    const prs = api(`pulls?state=open&base=main&per_page=100&page=${page}`);
    result.push(...prs);
    if (prs.length < 100) return result;
  }
}

function gateStatus(sha) {
  const result = api(`commits/${sha}/status`);
  return result.statuses.find((status) => status.context === context);
}

const live = {
  listPRs: openMainPRs,
  getPR: (number) => api(`pulls/${number}`),
  checksPassed: allChecksPassed,
  reviewPassed,
  getStatus: gateStatus,
  postStatus,
  log: console.log,
};

async function holdMonthlyGate(pr, description, io) {
  const status = await io.getStatus(pr.head.sha);
  // Do not revoke an independently approved initial promotion or hotfix.
  if (
    status?.state === "success" &&
    status.description?.startsWith("monthly release approved")
  ) {
    await io.postStatus(pr.head.sha, "pending", description);
  }
}

export async function openGate(
  number,
  mode,
  expectedHead,
  io = live,
  now = () => new Date(),
) {
  const pr = await io.getPR(number);
  const hold = async (reason) => {
    if (mode === "monthly") await holdMonthlyGate(pr, reason, io);
    io.log(`PR #${number}: ${reason}`);
    return false;
  };
  const reason = releaseApproval(pr, mode, expectedHead);
  if (reason) return hold(reason);
  if (!(await io.checksPassed(number)) || !(await io.reviewPassed(number))) {
    return hold("CI, release notes, or required review is not passing.");
  }
  const latest = await io.getPR(number);
  if (!sameApproval(pr, latest))
    return hold("PR changed while checks were evaluated; gate remains closed.");
  const changed = releaseApproval(latest, mode, expectedHead);
  if (changed) return hold(changed);
  if (mode === "monthly") {
    // Recheck after network calls: a slow check must not open an expired window.
    if (!isFirstMondayWindow(now()))
      return hold("Monthly release window is closed.");
    const candidates = (await io.listPRs()).filter(isMonthlyCandidate);
    if (candidates.length !== 1 || candidates[0].number !== number) {
      return hold("Expected exactly one armed monthly release PR.");
    }
  }
  if (!(await io.reviewPassed(number)))
    return hold("Required review changed during gate evaluation.");
  if (mode === "monthly" && !isFirstMondayWindow(now()))
    return hold("Monthly release window is closed.");
  const status = await io.getStatus(latest.head.sha);
  const confirmed = await io.getPR(number);
  if (
    !sameApproval(latest, confirmed) ||
    releaseApproval(confirmed, mode, expectedHead)
  )
    return hold("PR authorization changed before the status write.");
  if (mode === "monthly" && !isFirstMondayWindow(now()))
    return hold("Monthly release window is closed.");
  const description = `${mode} release approved for the exact reviewed commit`;
  if (status?.state !== "success" || status.description !== description) {
    await io.postStatus(latest.head.sha, "success", description);
  }
  io.log(`PR #${number}: opened ${context} for ${latest.head.sha}.`);
  return true;
}

function sameApproval(before, after) {
  return (
    before.head.sha === after.head.sha &&
    before.base.sha === after.base.sha &&
    before.body === after.body &&
    JSON.stringify(before.labels.map(({ name }) => name).sort()) ===
      JSON.stringify(after.labels.map(({ name }) => name).sort())
  );
}

function isMonthlyCandidate(pr) {
  return (
    pr.head.ref === "preview" &&
    pr.head.repo?.full_name === repository() &&
    pr.labels.some(({ name }) => name === "release-ready")
  );
}

export async function runMonthlyGate(
  io = live,
  now = () => new Date(),
  closeOnly = false,
) {
  const prs = await io.listPRs();
  const candidates = prs.filter(isMonthlyCandidate);
  if (closeOnly || !isFirstMondayWindow(now()) || candidates.length !== 1) {
    const reason =
      candidates.length > 1
        ? "Multiple armed monthly release PRs; gate closed."
        : "Monthly release window is closed or no release is armed.";
    for (const pr of prs) await holdMonthlyGate(pr, reason, io);
    io.log(reason);
    return false;
  }
  return openGate(candidates[0].number, "monthly", undefined, io, now);
}

async function main() {
  if (!repository() || !process.env.GH_TOKEN)
    throw new Error("GitHub repository and token are required.");
  if (
    ["pull_request", "pull_request_review"].includes(
      process.env.GITHUB_EVENT_NAME,
    )
  ) {
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

  const mode =
    process.env.GITHUB_EVENT_NAME === "push"
      ? "close"
      : process.env.GITHUB_EVENT_NAME === "schedule" &&
          process.env.RELEASE_SCHEDULE === "0 12 * * 1"
        ? "close"
        : process.env.RELEASE_MODE || "monthly";
  if (
    mode !== "monthly" &&
    mode !== "initial" &&
    mode !== "hotfix" &&
    mode !== "close"
  ) {
    throw new Error("Unknown release mode.");
  }
  if (
    mode !== "monthly" &&
    mode !== "close" &&
    !/^[a-f0-9]{40}$/.test(process.env.RELEASE_EXPECTED_SHA ?? "")
  ) {
    throw new Error("Manual release requires the exact expected head SHA.");
  }
  const number = Number(process.env.RELEASE_PR_NUMBER);
  if (
    mode !== "monthly" &&
    mode !== "close" &&
    (!Number.isSafeInteger(number) || number <= 0)
  ) {
    throw new Error("Manual release requires a PR number.");
  }
  if (mode === "monthly" || mode === "close") {
    await runMonthlyGate(live, () => new Date(), mode === "close");
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
