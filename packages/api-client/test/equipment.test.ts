import assert from "node:assert/strict";
import test from "node:test";

import { createMeadToolsApiClient, MeadToolsApiError, MeadToolsContractError, type ApiRequestInit } from "../src/index";

test("loads and updates inventory equipment through the existing typed API and preserves assignment conflicts", async () => {
  const id = "7dc4446a-d7f0-45a4-bc9b-2a0aa14b0563";
  const operation_id = "94d08cb3-c82b-4d65-b290-512dbf72502d";
  const brewId = "4982354b-8403-4503-af9b-1a71bcbdb79d";
  const equipment = { name: "Carboy", type: "vessel", capacity: { value: 5, unit: "gal" }, notes: null } as const;
  const stored = { ...equipment, id, group_id: id, label: null, brew: null };
  const seen: [string, ApiRequestInit][] = [];
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test",
    fetch: async (url, init) => {
      seen.push([url, init]);
      if (init.method === "PATCH") return {
        ok: false, status: 409, json: async () => ({ error: "The assignment changed", code: "ASSIGNMENT_CHANGED" })
      };
      return {
        ok: true, status: init.method === "GET" ? 200 : 201,
        json: async () => init.method === "GET" ? { can_manage: true, equipment: [stored], brews: [] } : { equipment: stored }
      };
    }
  });

  assert.deepEqual((await client.getEquipment()).equipment, [stored]);
  assert.deepEqual(await client.createEquipment({ equipment, operation_id, quantity: 2 }), { equipment: stored });
  const assignment = { action: "assign", operation_id, brew_id: brewId, expected_brew_id: null, reassign: false } as const;
  await assert.rejects(client.updateEquipment(id, assignment), (error) =>
    error instanceof MeadToolsApiError && error.status === 409 &&
    (error.body as { code?: string }).code === "ASSIGNMENT_CHANGED"
  );
  await assert.rejects(client.updateEquipment(id, { ...assignment, operation_id: "invalid" }), MeadToolsContractError);
  assert.deepEqual(seen.map(([url, { method }]) => [url.replace("https://meadtools.test", ""), method]), [
    ["/api/account/equipment", "GET"], ["/api/account/equipment", "POST"], [`/api/account/equipment/${id}`, "PATCH"]
  ]);
  assert.deepEqual(JSON.parse(seen[2][1].body!), assignment);
});
