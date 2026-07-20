import assert from "node:assert/strict";
import test from "node:test";

import { getWeblateGermanComponents } from "./queue-weblate-review.mjs";

const message = `chore(l10n): update German translation

Translation-Batch: weblate-auto`;

test("recognizes isolated German Weblate locale commits", () => {
  assert.deepEqual(
    getWeblateGermanComponents(message, ["packages/i18n/locales/de/default.json"]),
    ["default"],
  );
});

test("requires the Weblate batch marker and rejects mixed commits", () => {
  assert.deepEqual(
    getWeblateGermanComponents("fix: improve German copy", [
      "packages/i18n/locales/de/default.json",
    ]),
    [],
  );
  assert.deepEqual(
    getWeblateGermanComponents("chore(l10n): update German translation", [
      "packages/i18n/locales/de/default.json",
    ]),
    [],
  );
  assert.deepEqual(
    getWeblateGermanComponents(message, [
      "packages/i18n/locales/de/default.json",
      "apps/web/app/page.tsx",
    ]),
    [],
  );
});
