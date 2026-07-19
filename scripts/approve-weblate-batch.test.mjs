import assert from "node:assert/strict";
import test from "node:test";

import { getApprovalCommit } from "./approve-weblate-batch.mjs";

test("parses a full or abbreviated trusted batch approval command", () => {
  assert.equal(
    getApprovalCommit("/approve-translations 4bc98f5bfa12c52a47829ab59181b9a483bfb22a"),
    "4bc98f5bfa12c52a47829ab59181b9a483bfb22a",
  );
  assert.equal(getApprovalCommit("/approve-translations 4bc98f5"), "4bc98f5");
});

test("rejects non-command comments", () => {
  assert.equal(getApprovalCommit("/approve-translations"), null);
  assert.equal(getApprovalCommit("please approve translations"), null);
  assert.equal(getApprovalCommit("/approve-translations not-a-sha"), null);
});
