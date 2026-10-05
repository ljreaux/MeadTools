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
