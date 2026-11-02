import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateNoteGate } from "./check-pr-release-notes.mjs";

const entry = {
  title: "October 2026",
  summary: "Verified changes",
  products: { web: { items: ["A shipped improvement"] } },
};

test("accepts a new dated product note", () => {
  assert.equal(
    evaluateNoteGate({
      baseEntries: {},
      headEntries: { "2026-10-04": entry },
      labels: [],
      body: "",
    }).ok,
    true,
  );
});

test("rejects an unchanged note and a malformed entry", () => {
  assert.equal(
    evaluateNoteGate({
      baseEntries: { "2026-10-04": entry },
      headEntries: { "2026-10-04": entry },
      labels: [],
      body: "",
    }).ok,
    false,
  );
  assert.equal(
    evaluateNoteGate({
      baseEntries: {},
      headEntries: { "2026-10-04": { ...entry, products: {} } },
      labels: [],
      body: "",
    }).ok,
    false,
  );
});

test("requires a labeled, explained bug-only exemption", () => {
  const args = {
    baseEntries: {},
    headEntries: {},
    body: "Bug-fix rationale: Fixes a crash when loading saved recipes.",
  };
  assert.equal(evaluateNoteGate({ ...args, labels: [] }).ok, false);
  assert.equal(
    evaluateNoteGate({ ...args, labels: ["bug-fix-only"] }).ok,
    true,
  );
  assert.equal(
    evaluateNoteGate({
      ...args,
      labels: ["bug-fix-only"],
      body: "Bug-fix rationale: fix",
    }).ok,
    false,
  );
});

test("allows only the reviewed initial promotion to carry an internal draft", () => {
  const args = {
    baseEntries: {},
    headEntries: {},
    body: "",
    initialDraftChanged: true,
  };
  assert.match(
    evaluateNoteGate({ ...args, labels: [] }).reason,
    /initial-release-ready/,
  );
  assert.equal(
    evaluateNoteGate({ ...args, labels: ["initial-release-ready"] }).ok,
    true,
  );
  assert.equal(
    evaluateNoteGate({
      ...args,
      labels: ["initial-release-ready"],
      initialDraftChanged: false,
    }).ok,
    false,
  );
});

test("monthly internal notes require a changed draft, monthly PR, valid products, and review", () => {
  const args = {
    baseEntries: {},
    headEntries: {},
    labels: ["release-ready"],
    body: "",
    monthlyRelease: true,
    monthlyDraftChanged: true,
    monthlyDraft: entry,
  };
  assert.equal(evaluateNoteGate(args).ok, true);
  for (const change of [
    { monthlyRelease: false },
    { monthlyDraftChanged: false },
    { labels: [] },
    { monthlyDraft: { ...entry, products: {} } },
    {
      monthlyDraft: {
        ...entry,
        products: { mobilePreview: { items: ["Preview only"] } },
      },
    },
  ])
    assert.equal(evaluateNoteGate({ ...args, ...change }).ok, false);
});

test("policy note check validates real git diff, exact approval, and excludes public/app changes", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import(
    "node:fs"
  );
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const { execFileSync, spawnSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "meadtools-policy-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  try {
    git("init", "-q");
    git("config", "user.name", "Policy test");
    git("config", "user.email", "test@example.invalid");
    mkdirSync(join(dir, "scripts"));
    writeFileSync(join(dir, "scripts/release-policy.mjs"), "// original\n");
    git("add", ".");
    git("commit", "-qm", "base");
    const base = git("rev-parse", "HEAD");
    writeFileSync(
      join(dir, "scripts/release-policy.mjs"),
      "// reviewed policy\n",
    );
    git("add", ".");
    git("commit", "-qm", "policy");
    const head = git("rev-parse", "HEAD");
    const pr = {
      state: "open",
      draft: false,
      base: {
        ref: "main",
        sha: base,
        repo: { full_name: "ljreaux/MeadTools" },
      },
      head: {
        ref: "release/policy-test",
        sha: head,
        repo: { full_name: "ljreaux/MeadTools" },
      },
      labels: [{ name: "release-ready" }, { name: "policy-ready" }],
      body: `Release-ready head: ${head}\nRelease-ready base: ${base}\nMobile production build: skip\nPolicy approval: Larry Reaux approved this workflow policy change.`,
    };
    const eventPath = join(dir, "event.json");
    const run = () => {
      writeFileSync(eventPath, JSON.stringify({ pull_request: pr }));
      return spawnSync(
        process.execPath,
        [resolve("scripts/check-pr-release-notes.mjs")],
        {
          cwd: dir,
          env: { ...process.env, GITHUB_EVENT_PATH: eventPath },
          encoding: "utf8",
        },
      );
    };
    assert.equal(run().status, 0);
    pr.body = pr.body.replace("Policy approval:", "Unapproved:");
    assert.notEqual(run().status, 0);
    pr.body = pr.body.replace("Unapproved:", "Policy approval:");
    writeFileSync(
      join(dir, "application.js"),
      "// forbidden application change\n",
    );
    git("add", "application.js");
    git("commit", "-qm", "application");
    const mixed = git("rev-parse", "HEAD");
    pr.head.sha = mixed;
    pr.body = pr.body.replace(head, mixed);
    assert.notEqual(run().status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
