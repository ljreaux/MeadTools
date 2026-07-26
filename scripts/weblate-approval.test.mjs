import assert from "node:assert/strict";
import test from "node:test";

import { buildUnitApprovalPayload } from "./weblate-approval.mjs";

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
