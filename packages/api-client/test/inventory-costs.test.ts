import assert from "node:assert/strict";
import test from "node:test";

import { createMeadToolsApiClient, MeadToolsContractError, type ApiRequestInit } from "../src/index";

test("inventory cost routes preserve owner-only mixed totals and explicit exclusions", async () => {
  const id = "7dc4446a-d7f0-45a4-bc9b-2a0aa14b0563";
  const summary = {
    basis: "recipe_estimate", totals: [{ currency: "USD", amount: 21 }, { currency: "EUR", amount: 8 }],
    complete: false, mixed_currencies: true, per_liter: null, volume_liters: 10,
    missing: { unmatched: 1, unpriced: 0, ambiguous: 0, incompatible: 0 }, lines: []
  };
  const estimate = { can_manage: true, share_cost_summary: false, estimate: summary };
  const brew = {
    can_manage: true, share_cost_summary: false, planned: summary,
    recorded: { ...summary, basis: "recorded_usage", per_bottle: null, volume_source: "current" }
  };
  const exclusions = { exclusions: [{ id, name: "Tap water", catalog_reference: null }] };
  const seen: [string, ApiRequestInit][] = [];
  const api = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test",
    fetch: async (url, init) => {
      const path = new URL(url).pathname;
      seen.push([path, init]);
      return { ok: true, status: 200, json: async () => path.endsWith("/currency") ? { currency: "EUR" } :
        path.endsWith("/cost-exclusions") ? exclusions : path.includes("/brews/") ? brew : estimate };
    }
  });
  assert.deepEqual(await api.updateInventoryCurrency({ currency: "EUR" }), { currency: "EUR" });
  assert.deepEqual(await api.getInventoryCostExclusions(), exclusions);
  await api.updateInventoryCostExclusions({ action: "exclude", name: "Tap water", catalog_reference: null });
  assert.equal((await api.getBrewCosts(id)).recorded.per_liter, null);
  await api.updateBrewCosts(id, { action: "recalculate", operation_id: id });
  assert.deepEqual((await api.getRecipeCosts(42)).estimate.totals, summary.totals);
  await assert.rejects(api.updateInventoryCurrency({ currency: "XXX" }), MeadToolsContractError);
  assert.deepEqual(seen.map(([path, init]) => [path, init.method]), [
    ["/api/account/inventory/currency", "PUT"], ["/api/account/inventory/cost-exclusions", "GET"],
    ["/api/account/inventory/cost-exclusions", "PATCH"], [`/api/brews/${id}/costs`, "GET"],
    [`/api/brews/${id}/costs`, "POST"], ["/api/recipes/42/costs", "GET"]
  ]);
  assert.deepEqual(JSON.parse(seen[4][1].body!), { action: "recalculate", operation_id: id });
});
