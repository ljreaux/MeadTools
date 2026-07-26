import assert from "node:assert/strict";
import test from "node:test";

import { getWeblateGermanComponents } from "./queue-weblate-review.mjs";
import { getIssueApprovalCommit } from "./approve-weblate-issue.mjs";

const message = `chore(l10n): update German translation

Translation-Batch: weblate-auto`;

test("recognizes isolated German Weblate locale commits", () => {
  assert.deepEqual(
    getWeblateGermanComponents(message, ["packages/i18n/locales/de/default.json"]),
    ["default"],
  );
});

test("recognizes native Weblate commits after English source changes and rejects mixed commits", () => {
  assert.deepEqual(
    getWeblateGermanComponents("fix: improve German copy", [
      "packages/i18n/locales/de/default.json",
    ]),
    [],
  );
  assert.deepEqual(
    getWeblateGermanComponents(
      "chore(l10n): update German translation",
      ["packages/i18n/locales/de/default.json"],
      ["packages/i18n/locales/en/default.json"],
    ),
    ["default"],
  );
  assert.deepEqual(
    getWeblateGermanComponents(message, [
      "packages/i18n/locales/de/default.json",
      "apps/web/app/page.tsx",
    ]),
    [],
  );
});

test("accepts only an exact no-op approval command with a commit prefix", () => {
  assert.equal(getIssueApprovalCommit("/approve-weblate bd1cdb2"), "bd1cdb2");
  assert.equal(
    getIssueApprovalCommit("  /approve-weblate BD1CDB2919441ECb4390A8dC8b72fa05c77e49E8  "),
    "bd1cdb2919441ecb4390a8dc8b72fa05c77e49e8",
  );
  assert.equal(getIssueApprovalCommit("please /approve-weblate bd1cdb2"), null);
  assert.equal(getIssueApprovalCommit("/approve-weblate not-a-commit"), null);
});
