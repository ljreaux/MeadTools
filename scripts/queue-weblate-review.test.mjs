import assert from "node:assert/strict";
import test from "node:test";

import { getAiGermanComponents } from "./queue-weblate-review.mjs";

const message = `chore(l10n): add German AI translations

Translation-Batch: ai-generated`;

test("recognizes isolated German AI locale commits", () => {
  assert.deepEqual(
    getAiGermanComponents(message, ["packages/i18n/locales/de/default.json"]),
    ["default"],
  );
});

test("requires the AI batch marker and rejects mixed commits", () => {
  assert.deepEqual(
    getAiGermanComponents("fix: improve German copy", [
      "packages/i18n/locales/de/default.json",
    ]),
    [],
  );
  assert.deepEqual(
    getAiGermanComponents("chore(l10n): add German AI translations", [
      "packages/i18n/locales/de/default.json",
    ]),
    [],
  );
  assert.deepEqual(
    getAiGermanComponents(message, [
      "packages/i18n/locales/de/default.json",
      "apps/web/app/page.tsx",
    ]),
    [],
  );
});
