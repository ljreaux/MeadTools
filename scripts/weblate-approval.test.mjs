import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUnitApprovalPayload,
  findExpectedWeblateUnit,
  getPullRequestPayload,
} from "./weblate-approval.mjs";

test("approving a Weblate unit preserves its target value", () => {
  assert.deepEqual(
    buildUnitApprovalPayload({ id: 1460, target: ["Nicht autorisiert"] }),
    { state: 30, target: ["Nicht autorisiert"] },
  );
});

test("approving a Weblate unit requires a target value", () => {
  assert.throws(
    () => buildUnitApprovalPayload({ id: 1460, target: [] }),
    /has no translation target/,
  );
});

test("manual recovery uses the same pull request payload shape as an event", () => {
  const pullRequest = { labels: [], user: { login: "rizzek" } };
  assert.equal(getPullRequestPayload({ pull_request: pullRequest }), pullRequest);
  assert.equal(getPullRequestPayload(pullRequest), pullRequest);
});

test("finds a unit with a search-reserved context name", () => {
  const unit = { id: 2188, context: "error", target: ["Etwas ist schiefgelaufen"] };
  assert.equal(
    findExpectedWeblateUnit([unit], {
      context: "error",
      target: "Etwas ist schiefgelaufen",
    }),
    unit,
  );
});
