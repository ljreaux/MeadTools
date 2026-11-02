import { execFileSync, spawnSync } from "node:child_process";
import { policyApproval, policyDiffPassed } from "./release-policy.mjs";
import { isDeepStrictEqual } from "node:util";
import { evaluateNoteGate } from "./check-pr-release-notes.mjs";
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
    (!["hotfix", "policy"].includes(mode) && pr.head.ref !== "preview") ||
    pr.head.repo?.full_name !== repository()
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
  if (mode === "policy" && (!expectedHead || !policyApproval(pr, expectedHead)))
    return "Policy maintenance requires reviewed exact-SHA policy-ready authorization.";
  if (mode === "publication") {
    if (!expectedHead || !labels.has("publication-ready"))
      return "Publication requires an expected head SHA and publication-ready label.";
    if (
      build !== "skip" ||
      labels.has("bug-fix-only") ||
      labels.has("hotfix-ready") ||
      labels.has("initial-release-ready") ||
      labels.has("policy-ready")
    )
      return "Publication requires Mobile skip and no promotion/exemption labels.";
    if (
      !/^Publication approval: Larry Reaux approved publication after production verification\.\s*$/m.test(
        body,
      )
    )
      return "Explicit post-deployment publication approval is missing.";
    if (!/^Publication date: \d{4}-\d{2}-\d{2}\s*$/m.test(body))
      return "Publication date is missing.";
  }
  if (["monthly", "publication", "policy"].includes(mode) && !pr.auto_merge)
    return "Native GitHub auto-merge is not armed.";
  return null;
}

// Publication may add exactly one approved date, with no application or unrelated
// locale changes. Compare full JSON objects rather than trusting paths or patches.
export function publicationDiffPassed(pr, files, now = new Date()) {
  const date = (pr.body ?? "").match(
    /^Publication date: (\d{4}-\d{2}-\d{2})\s*$/m,
  )?.[1];
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
  }).format(now);
  if (!date || date > today || !Array.isArray(files) || !files.length)
    return false;
  const notesPath = "packages/i18n/locales/en/default.json";
  if (!files.some(({ path }) => path === notesPath)) return false;
  for (const file of files) {
    if (
      file.path === `docs/releases/${date.slice(0, 7)}.md` &&
      ["added", "modified"].includes(file.status)
    )
      continue;
    if (
      !/^packages\/i18n\/locales\/(en|de)\/default\.json$/.test(file.path) ||
      file.status !== "modified"
    )
      return false;
    try {
      const before = JSON.parse(file.before);
      const after = JSON.parse(file.after);
      const oldEntries = before.releaseNotes?.entries ?? {};
      const newEntries = after.releaseNotes?.entries ?? {};
      if (Object.hasOwn(oldEntries, date) || !Object.hasOwn(newEntries, date))
        return false;
      const entry = newEntries[date];
      if (entry.products?.mobile || entry.products?.mobilePreview) return false;
      if (
        !evaluateNoteGate({
          baseEntries: {},
          headEntries: { [date]: entry },
          labels: [],
          body: "",
        }).ok
      )
        return false;
      delete newEntries[date];
      if (!isDeepStrictEqual(before, after)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function changedFiles(pr) {
  const files = [];
  for (let page = 1; ; page++) {
    const batch = api(`pulls/${pr.number}/files?per_page=100&page=${page}`);
    files.push(...batch);
    if (batch.length < 100) break;
    if (files.length >= 3000)
      throw new Error("Release diff exceeds GitHub's file limit.");
  }
  if (files.length !== pr.changed_files)
    throw new Error("Incomplete release diff.");
  return files;
}

function publicationFiles(pr) {
  return changedFiles(pr).map((file) => {
    const path = file.filename;
    if (
      !/^packages\/i18n\/locales\/(en|de)\/default\.json$/.test(path) ||
      file.status !== "modified"
    )
      return { path, status: file.status };
    const read = (sha) => {
      const content = api(`contents/${path}?ref=${sha}`);
      if (content.encoding !== "base64")
        throw new Error("Cannot read full locale content.");
      return Buffer.from(content.content, "base64").toString("utf8");
    };
    return {
      path,
      status: file.status,
      before: read(pr.base.sha),
      after: read(pr.head.sha),
    };
  });
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

function allChecksPassed(number, mode) {
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
  if (!releaseChecksPassed(JSON.parse(result.stdout))) return false;
  if (!["publication", "policy"].includes(mode)) return true;
  // Required checks must also pass, including any required Expo check that the
  // normal promotion policy excludes from its visible-check scan.
  const required = spawnSync(
    "gh",
    [
      "pr",
      "checks",
      String(number),
      "--repo",
      repository(),
      "--required",
      "--json",
      "name,bucket",
    ],
    { encoding: "utf8" },
  );
  // gh exits 8 while our own gate is pending. Read the JSON, but reject API errors.
  if (![0, 1, 8].includes(required.status) || !required.stdout)
    throw new Error("Could not read required publication checks.");
  return publicationRequiredChecksPassed(JSON.parse(required.stdout));
}

export function publicationRequiredChecksPassed(required) {
  const checks = required.filter(({ name }) => name !== context);
  return (
    checks.some(
      ({ name, bucket }) =>
        name === "Release notes or reviewed bug fix" && bucket === "pass",
    ) && checks.every(({ bucket }) => bucket === "pass")
  );
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
    if (prs.length < 100) {
      const base = api("git/ref/heads/main").object.sha;
      return result.map((pr) => ({ ...pr, base: { ...pr.base, sha: base } }));
    }
  }
}

function gateStatus(sha) {
  const result = api(`commits/${sha}/status`);
  return result.statuses.find((status) => status.context === context);
}

// Pull-request snapshots may retain the old base SHA after main advances.
// Bind authorization to the live target ref on every read, including the final
// read before writing success, rather than accepting that cached snapshot.
export function currentMainPR(number, read = api) {
  const pr = read(`pulls/${number}`);
  if (pr.base.ref === "main")
    pr.base.sha = read("git/ref/heads/main").object.sha;
  return pr;
}

const live = {
  listPRs: openMainPRs,
  getPR: currentMainPR,
  checksPassed: allChecksPassed,
  policyPassed: (pr) =>
    policyDiffPassed(
      changedFiles(pr).map((file) => ({
        path: file.filename,
        status: file.status,
      })),
    ),
  publicationPassed: (pr, now) =>
    publicationDiffPassed(pr, publicationFiles(pr), now),
  reviewPassed,
  getStatus: gateStatus,
  postStatus,
  log: console.log,
};

async function holdMonthlyGate(pr, description, io) {
  const status = await io.getStatus(pr.head.sha);
  // Preserve valid independent approvals; revoke stale publication/policy approval.
  if (
    status?.state === "success" &&
    (status.description?.startsWith("monthly release approved") ||
      (status.description?.startsWith("publication release approved") &&
        releaseApproval(pr, "publication", pr.head.sha)) ||
      (status.description?.startsWith("policy release approved") &&
        releaseApproval(pr, "policy", pr.head.sha)))
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
    if (["publication", "policy"].includes(mode)) {
      const status = await io.getStatus(pr.head.sha);
      if (
        status?.state === "success" &&
        status.description?.startsWith(`${mode} release approved`)
      )
        await io.postStatus(pr.head.sha, "pending", reason);
    }
    io.log(`PR #${number}: ${reason}`);
    return false;
  };
  const reason = releaseApproval(pr, mode, expectedHead);
  if (reason) return hold(reason);
  if (
    !(await io.checksPassed(number, mode)) ||
    !(await io.reviewPassed(number))
  ) {
    return hold("CI, release notes, or required review is not passing.");
  }
  if (mode === "publication" && !(await io.publicationPassed(pr, now())))
    return hold(
      "Publication diff is not limited to the approved dated notes and record.",
    );
  if (mode === "policy" && !(await io.policyPassed(pr)))
    return hold(
      "Policy diff includes files outside the reviewed release-policy allowlist.",
    );
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
    mode !== "publication" &&
    mode !== "policy" &&
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
  if (
    ["publication", "policy"].includes(mode) &&
    process.env.GITHUB_EVENT_NAME !== "workflow_dispatch"
  )
    throw new Error("Publication requires a reviewed manual dispatch.");
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
