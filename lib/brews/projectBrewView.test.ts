import assert from "node:assert/strict";
import test from "node:test";

import { projectBrewView } from "@/lib/brews/projectBrewView";

test("projectBrewView excludes authorization, alert, and device fields", () => {
  const projected = projectBrewView({
    id: "brew-1",
    name: "Read only batch",
    start_date: new Date("2026-01-01T00:00:00.000Z"),
    end_date: null,
    stage: "PRIMARY",
    batch_number: 4,
    current_volume_liters: 18.5,
    gravity_unit_preference: "SG",
    latest_gravity: 1.052,
    public: true,
    recipe_id: 12,
    recipe_name: "Test recipe",
    entry_count: 1,
    owner: { displayName: "Brewer" },
    user_id: 99,
    requested_email_alerts: true,
    entries: [
      {
        id: "entry-1",
        datetime: "2026-01-02T00:00:00.000Z",
        type: "GRAVITY",
        title: "Gravity",
        note: "Visible to the selected controller",
        gravity: 1.052,
        temperature: null,
        temp_units: null,
        data: null,
        user_id: 99
      }
    ],
    entries_by_stage: [],
    logs: [
      {
        id: "log-1",
        brew_id: "brew-1",
        device_id: "device-secret",
        datetime: "2026-01-02T01:00:00.000Z",
        temperature: 68,
        temp_units: "F",
        battery: 3.9,
        gravity: 1.051,
        calculated_gravity: 1.05
      }
    ]
  });

  const serialized = JSON.stringify(projected);

  assert.equal("user_id" in projected, false);
  assert.equal("requested_email_alerts" in projected, false);
  assert.equal(projected.public, true);
  assert.equal("user_id" in projected.entries[0], false);
  assert.equal("device_id" in projected.logs[0], false);
  assert.equal("brew_id" in projected.logs[0], false);
  assert.equal("id" in projected.logs[0], false);
  assert.doesNotMatch(serialized, /device-secret|requested_email_alerts|user_id|device_id/);
});

test("projectBrewView supports a sanitized payload with optional content omitted", () => {
  const projected = projectBrewView({
    id: "brew-2",
    name: null,
    start_date: "2026-02-01T00:00:00.000Z",
    end_date: null,
    stage: "PLANNED",
    batch_number: null,
    current_volume_liters: null,
    gravity_unit_preference: "SG",
    latest_gravity: null,
    public: null,
    recipe_id: null,
    recipe_name: null,
    entry_count: 0
  });

  assert.deepEqual(projected.entries, []);
  assert.deepEqual(projected.entries_by_stage, []);
  assert.deepEqual(projected.logs, []);
  assert.equal(projected.recipe_snapshot, null);
  assert.equal(projected.owner, null);
  assert.equal(projected.public, false);
});
