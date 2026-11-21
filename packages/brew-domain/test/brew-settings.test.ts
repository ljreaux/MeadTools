import assert from "node:assert/strict";
import test from "node:test";

import {
  brewSettingsChanges,
  brewSettingsDraft,
  canChangeBrewVisibility,
  parseBatchNumber,
  type BrewSettingsSource
} from "../src/brew-settings";

const brew: BrewSettingsSource = {
  name: "Spring batch",
  batch_number: 2,
  start_date: "2026-03-01T12:00:00.000Z",
  requested_email_alerts: false,
  public: false,
  recipe_id: 4,
  recipe_private: false
};

test("batch numbers are blank or whole numbers of 1 or more", () => {
  assert.equal(parseBatchNumber(" "), null);
  assert.equal(parseBatchNumber(" 12 "), 12);
  for (const invalid of ["0", "-1", "1.5", "1,5", "abc", "1e3", "99999999999999999"]) {
    assert.equal(parseBatchNumber(invalid), undefined, invalid);
  }
});

test("visibility can change only for brews linked to a public recipe", () => {
  assert.equal(canChangeBrewVisibility(brew), true);
  assert.equal(canChangeBrewVisibility({ recipe_id: 4, recipe_private: true }), false);
  assert.equal(canChangeBrewVisibility({ recipe_id: 4, recipe_private: null }), false);
  assert.equal(canChangeBrewVisibility({ recipe_id: null, recipe_private: null }), false);
});

test("an untouched draft has no changes", () => {
  assert.deepEqual(brewSettingsChanges(brew, brewSettingsDraft(brew)), { ok: true, changes: {} });
  const unnamed = { ...brew, name: null, batch_number: null };
  assert.deepEqual(brewSettingsChanges(unnamed, brewSettingsDraft(unnamed)), {
    ok: true,
    changes: {}
  });
});

test("only edited fields are sent, with names trimmed and blanks cleared", () => {
  const draft = {
    ...brewSettingsDraft(brew),
    name: "  Autumn batch ",
    batch: "",
    startDate: new Date("2026-02-01T09:30:00.000Z"),
    emailAlerts: true,
    public: true
  };
  assert.deepEqual(brewSettingsChanges(brew, draft), {
    ok: true,
    changes: {
      name: "Autumn batch",
      batch_number: null,
      start_date: "2026-02-01T09:30:00.000Z",
      requested_email_alerts: true,
      public: true
    }
  });
  assert.deepEqual(brewSettingsChanges(brew, { ...brewSettingsDraft(brew), name: "  " }), {
    ok: true,
    changes: { name: null }
  });
});

test("sharing a brew of a private recipe is never sent; turning sharing off is", () => {
  const privateRecipe = { ...brew, recipe_private: true };
  assert.deepEqual(
    brewSettingsChanges(privateRecipe, { ...brewSettingsDraft(privateRecipe), public: true }),
    { ok: true, changes: {} }
  );
  const shared = { ...privateRecipe, public: true };
  assert.deepEqual(
    brewSettingsChanges(shared, { ...brewSettingsDraft(shared), public: false }),
    { ok: true, changes: { public: false } }
  );
});

test("invalid batch numbers and dates are reported instead of sent", () => {
  assert.deepEqual(brewSettingsChanges(brew, { ...brewSettingsDraft(brew), batch: "0" }), {
    ok: false,
    error: "batch"
  });
  assert.deepEqual(
    brewSettingsChanges(brew, { ...brewSettingsDraft(brew), startDate: new Date("nope") }),
    { ok: false, error: "startDate" }
  );
});
