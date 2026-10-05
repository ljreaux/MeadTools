import assert from "node:assert/strict";
import test from "node:test";

import { projectBrewOverview } from "../src/overview";

const brew = {
  recipe_name: "Live recipe name",
  current_volume_liters: 3.5,
  latest_gravity: 1.04
};

test("overview derives recipe targets from a complete snapshot", () => {
  const overview = projectBrewOverview({
    ...brew,
    recipe_snapshot: {
      name: "Snapshot name",
      dataV2: {
        version: 2,
        unitDefaults: { weight: "lb", volume: "gal" },
        ingredients: [{
          lineId: "honey",
          name: "Honey",
          ref: { kind: "custom" },
          category: "sugar",
          brix: "79.6",
          secondary: false,
          amounts: {
            weight: { value: "3", unit: "lb" },
            volume: { value: "0.25", unit: "gal" },
            basis: "weight"
          }
        }],
        fg: "1.000",
        additives: [],
        stabilizers: { adding: false, takingPh: false, phReading: "", type: "kmeta" },
        notes: { primary: [], secondary: [] }
      }
    }
  });

  assert.equal(overview.recipeName, "Snapshot name");
  assert.deepEqual(overview.ingredients, [{
    id: "honey",
    name: "Honey",
    amount: "3",
    unit: "lb",
    secondary: false
  }]);
  assert.ok(overview.targetVolumeLiters && overview.targetVolumeLiters > 0);
  assert.ok(overview.targetOg && overview.targetOg > 1);
  assert.equal(overview.targetFg, 1);
  assert.equal(overview.currentVolumeLiters, 3.5);
});

test("overview keeps available fields when a legacy snapshot has no recipe data", () => {
  const overview = projectBrewOverview({
    ...brew,
    recipe_snapshot: {
      name: "Older snapshot",
      dataV2: {
        ingredients: [{
          lineId: "honey",
          name: "Honey",
          ref: { kind: "custom" },
          category: "sugar",
          brix: "79.6",
          secondary: false,
          amounts: {
            weight: { value: "3", unit: "lb" },
            volume: { value: "0.25", unit: "gal" },
            basis: "weight"
          }
        }]
      }
    }
  });

  assert.equal(overview.recipeName, "Older snapshot");
  assert.equal(overview.targetOg, null);
  assert.equal(overview.targetFg, null);
  assert.equal(overview.targetVolumeLiters, null);
  assert.equal(overview.ingredients[0]?.name, "Honey");
  assert.equal(overview.latestGravity, 1.04);
});
