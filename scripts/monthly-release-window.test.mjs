import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isFirstMondayWindow,
  releaseApproval,
  releaseChecksPassed,
} from "./monthly-release-window.mjs";

test("opens at 9:15 Chicago on the first Monday, including across DST", () => {
  assert.equal(isFirstMondayWindow(new Date("2026-11-02T15:14:00Z")), false);
  assert.equal(isFirstMondayWindow(new Date("2026-11-02T15:15:00Z")), true);
  assert.equal(isFirstMondayWindow(new Date("2026-12-07T15:15:00Z")), true);
  assert.equal(isFirstMondayWindow(new Date("2026-12-14T15:15:00Z")), false);
});

test("readiness is tied to head, base, labels, build choice, and auto-merge", () => {
  process.env.GITHUB_REPOSITORY = "ljreaux/MeadTools";
  const head = "a".repeat(40);
  const base = "b".repeat(40);
  const pr = {
    state: "open",
    draft: false,
    auto_merge: { enabled_by: { login: "owner" } },
    base: { ref: "main", sha: base },
    head: {
      ref: "preview",
      sha: head,
      repo: { full_name: "ljreaux/MeadTools" },
    },
    labels: [{ name: "release-ready" }],
    body: `Release-ready head: ${head}\nRelease-ready base: ${base}\nMobile production build: skip`,
  };
  assert.equal(releaseApproval(pr, "monthly"), null);
  assert.match(
    releaseApproval(
      { ...pr, head: { ...pr.head, sha: "c".repeat(40) } },
      "monthly",
    ),
    /SHA/,
  );
  assert.match(releaseApproval({ ...pr, labels: [] }, "monthly"), /label/);
  assert.match(
    releaseApproval(
      { ...pr, labels: [...pr.labels, { name: "build-mobile-production" }] },
      "monthly",
    ),
    /Mobile/,
  );
  assert.match(
    releaseApproval({ ...pr, auto_merge: null }, "monthly"),
    /auto-merge/,
  );
  assert.match(releaseApproval(pr, "initial"), /initial-release-ready/);
});

test("Expo preview queue does not hold a reviewed main release", () => {
  const notes = { name: "Release notes or reviewed bug fix", bucket: "pass" };
  const quality = { name: "Typecheck and export mobile", bucket: "pass" };
  const expo = {
    name: "Create Preview Builds / Check preview build gate (@ljreaux/mobile)",
    bucket: "pending",
  };
  const gate = { name: "monthly-release-gate", bucket: "pending" };
  assert.equal(releaseChecksPassed([notes, quality, expo, gate]), true);
  assert.equal(
    releaseChecksPassed([notes, { ...quality, bucket: "fail" }, expo, gate]),
    false,
  );
  assert.equal(releaseChecksPassed([quality, expo, gate]), false);
});

const { runMonthlyGate, releaseReviewPassed } = await import(
  "./monthly-release-window.mjs"
);
const head = "a".repeat(40);
const base = "b".repeat(40);
const inWindow = () => new Date("2026-11-02T15:30:00Z");
function fixture() {
  process.env.GITHUB_REPOSITORY = "ljreaux/MeadTools";
  const pr = {
    number: 1,
    state: "open",
    draft: false,
    auto_merge: {},
    base: { ref: "main", sha: base },
    head: {
      ref: "preview",
      sha: head,
      repo: { full_name: "ljreaux/MeadTools" },
    },
    labels: [{ name: "release-ready" }],
    body: `Release-ready head: ${head}\nRelease-ready base: ${base}\nMobile production build: skip`,
  };
  let status;
  const posts = [];
  const io = {
    listPRs: () => [pr],
    getPR: () => structuredClone(pr),
    checksPassed: () => true,
    reviewPassed: () => true,
    getStatus: () => status,
    postStatus: (sha, state, description) => {
      posts.push({ sha, state, description });
      status = { state, description };
    },
    log: () => {},
  };
  return {
    pr,
    io,
    posts,
    setStatus: (value) => {
      status = value;
    },
  };
}

test("window ends at noon Chicago and remains closed on other days, across DST", () => {
  for (const value of [
    "2026-11-02T18:00:00Z",
    "2026-11-03T15:30:00Z",
    "2026-10-05T17:00:00Z",
  ]) {
    assert.equal(isFirstMondayWindow(new Date(value)), false);
  }
  assert.equal(isFirstMondayWindow(new Date("2026-11-02T17:59:59Z")), true);
  assert.equal(isFirstMondayWindow(new Date("2026-10-05T14:15:00Z")), true);
});

test("successful monthly run is idempotent and closes its status at noon", async () => {
  const f = fixture();
  assert.equal(await runMonthlyGate(f.io, inWindow), true);
  assert.equal(await runMonthlyGate(f.io, inWindow), true);
  assert.equal(f.posts.length, 1);
  await runMonthlyGate(f.io, () => new Date("2026-11-02T18:00:00Z"));
  assert.deepEqual(
    f.posts.map(({ state }) => state),
    ["success", "pending"],
  );
  await runMonthlyGate(f.io, () => new Date("2026-11-02T18:01:00Z"));
  assert.equal(f.posts.length, 2);
});

test("early run and no-work month never open a gate", async () => {
  const f = fixture();
  await runMonthlyGate(f.io, () => new Date("2026-11-02T15:14:00Z"));
  f.io.listPRs = () => [];
  await runMonthlyGate(f.io, inWindow);
  assert.equal(f.posts.length, 0);
});

test("multiple candidates close a previously opened monthly gate", async () => {
  const f = fixture();
  await runMonthlyGate(f.io, inWindow);
  f.io.listPRs = () => [f.pr, { ...f.pr, number: 2 }];
  assert.equal(await runMonthlyGate(f.io, inWindow), false);
  assert.deepEqual(
    f.posts.map(({ state }) => state),
    ["success", "pending"],
  );
});

test("a second candidate arriving during evaluation prevents opening", async () => {
  const f = fixture();
  let calls = 0;
  f.io.listPRs = () =>
    ++calls === 1 ? [f.pr] : [f.pr, { ...f.pr, number: 2 }];
  assert.equal(await runMonthlyGate(f.io, inWindow), false);
  assert.equal(f.posts.length, 0);
});

test("failed or pending CI, required review, and changed SHAs keep the gate closed", async () => {
  for (const mutate of [
    (f) => {
      f.io.checksPassed = () => false;
    },
    (f) => {
      f.io.reviewPassed = () => false;
    },
    (f) => {
      f.pr.head.sha = "c".repeat(40);
    },
    (f) => {
      f.pr.base.sha = "c".repeat(40);
    },
    (f) => {
      f.pr.labels = [];
    },
    (f) => {
      f.pr.auto_merge = null;
    },
  ]) {
    const f = fixture();
    mutate(f);
    assert.equal(await runMonthlyGate(f.io, inWindow), false);
    assert.equal(f.posts.length, 0);
  }
  const notes = { name: "Release notes or reviewed bug fix", bucket: "pass" };
  assert.equal(
    releaseChecksPassed([notes, { name: "Quality", bucket: "pending" }]),
    false,
  );
});

test("revoked readiness or failed checks close a previous success", async () => {
  for (const mutate of [
    (f) => {
      f.io.checksPassed = () => false;
    },
    (f) => {
      f.pr.labels = [];
    },
    (f) => {
      f.io.reviewPassed = () => false;
    },
  ]) {
    const f = fixture();
    await runMonthlyGate(f.io, inWindow);
    mutate(f);
    await runMonthlyGate(f.io, inWindow);
    assert.deepEqual(
      f.posts.map(({ state }) => state),
      ["success", "pending"],
    );
  }
});

test("expiry during checks, PR changes, and review changes prevent opening", async () => {
  for (const mutate of [
    (f) => {
      f.io.checksPassed = () => {
        f.pr.head.sha = "c".repeat(40);
        return true;
      };
    },
    (f) => {
      f.io.checksPassed = () => {
        f.pr.body += "\nchanged";
        return true;
      };
    },
    (f) => {
      let calls = 0;
      f.io.reviewPassed = () => ++calls === 1;
    },
  ]) {
    const f = fixture();
    mutate(f);
    assert.equal(await runMonthlyGate(f.io, inWindow), false);
    assert.equal(f.posts.length, 0);
  }
  const f = fixture();
  let calls = 0;
  const now = () =>
    ++calls === 1 ? inWindow() : new Date("2026-11-02T18:00:00Z");
  assert.equal(await runMonthlyGate(f.io, now), false);
  assert.equal(f.posts.length, 0);
});

test("close-only dispatch never opens and preserves independent hotfix approval", async () => {
  const f = fixture();
  await runMonthlyGate(f.io, inWindow, true);
  assert.equal(f.posts.length, 0);
  f.setStatus({
    state: "success",
    description: "hotfix release approved for the exact reviewed commit",
  });
  await runMonthlyGate(f.io, () => new Date("2026-11-03T18:00:00Z"), true);
  assert.equal(f.posts.length, 0);
});

test("unknown and outstanding review decisions are not approval", () => {
  for (const decision of [
    null,
    undefined,
    "REVIEW_REQUIRED",
    "CHANGES_REQUESTED",
  ]) {
    assert.equal(releaseReviewPassed(decision), false);
  }
  assert.equal(releaseReviewPassed(""), true);
  assert.equal(releaseReviewPassed("APPROVED"), true);
});

test("the running gate job does not wait for its own completion", () => {
  assert.equal(
    releaseChecksPassed([
      { name: "Release notes or reviewed bug fix", bucket: "pass" },
      { name: "Hold or open monthly release gate", bucket: "pending" },
      { name: "monthly-release-gate", bucket: "pending" },
    ]),
    true,
  );
});

test("authorization and expiry are rechecked after the status lookup", async () => {
  const f = fixture();
  f.io.getStatus = () => {
    f.pr.head.sha = "c".repeat(40);
    return undefined;
  };
  assert.equal(await runMonthlyGate(f.io, inWindow), false);
  assert.equal(f.posts.length, 0);
  const expired = fixture();
  let now = inWindow();
  expired.io.getStatus = () => {
    now = new Date("2026-11-02T18:00:00Z");
  };
  assert.equal(await runMonthlyGate(expired.io, () => now), false);
  assert.equal(expired.posts.length, 0);
});

test("reviewed hotfix can open outside monthly window only for the approved SHA", async () => {
  const { openGate } = await import("./monthly-release-window.mjs");
  const f = fixture();
  f.pr.head.ref = "hotfix";
  f.pr.labels.push({ name: "hotfix-ready" }, { name: "bug-fix-only" });
  const outside = () => new Date("2026-11-03T18:00:00Z");
  assert.equal(
    await openGate(1, "hotfix", "c".repeat(40), f.io, outside),
    false,
  );
  assert.equal(f.posts.length, 0);
  assert.equal(await openGate(1, "hotfix", head, f.io, outside), true);
  assert.equal(f.posts[0].state, "success");
});
