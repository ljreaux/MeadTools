import assert from "node:assert/strict";
import test from "node:test";

import { createMeadToolsApiClient, MeadToolsContractError, type ApiRequestInit } from "../src/index";

test("uses the existing finished mead, organization and movement history routes", async () => {
  const id = "7dc4446a-d7f0-45a4-bc9b-2a0aa14b0563";
  const operation_id = "94d08cb3-c82b-4d65-b290-512dbf72502d";
  const expected_revision = "a".repeat(64);
  const baseUrl = "https://meadtools.test";
  const base = "/api/account/inventory";
  const record = { id, revision: expected_revision, name: "Test", notes: null, bottles: [] };
  const seen: [string, ApiRequestInit][] = [];
  const client = createMeadToolsApiClient({
    baseUrl,
    fetch: async (url, init) => {
      const path = url.slice(baseUrl.length);
      seen.push([path, init]);
      return {
        ok: true, status: 200,
        json: async () => {
          if (path.includes("/meads")) {
            return init.method === "GET" ? { mead: record, adjustments: [], has_more: false } : { mead_id: id };
          }
          return init.method === "GET" ? { changes: [], has_more: false } : { id };
        }
      };
    }
  });

  assert.equal((await client.getFinishedMead(id)).mead.id, id);
  assert.equal((await client.createFinishedMead({ operation_id, mead: { name: "Test", notes: null, bottles: [{ size_liters: 0.75, quantity: 2 }] } })).mead_id, id);
  await client.updateFinishedMead(id, { action: "archive", operation_id, expected_revision });
  await client.updateInventoryOrganization({ action: "assign_labels", kind: "mead", id, operation_id, label_ids: [], expected_label_ids: [] });
  assert.deepEqual((await client.getInventoryStorageHistory(id)).changes, []);
  await client.updateInventoryStorage(id, { operation_id, expected_revision, allocations: [] });

  const [meadUpdate, categoryUpdate, storageUpdate] = [seen[2], seen[3], seen[5]];
  assert.equal(JSON.parse(meadUpdate[1].body!).expected_revision, expected_revision);
  assert.deepEqual(JSON.parse(categoryUpdate[1].body!).expected_label_ids, []);
  assert.equal(JSON.parse(storageUpdate[1].body!).operation_id, operation_id);
  await assert.rejects(client.updateInventoryStorage(id, { operation_id, expected_revision: "stale", allocations: [] }), MeadToolsContractError);
  assert.deepEqual(seen.map(([path, { method }]) => [path, method]), [
    [`${base}/meads/${id}`, "GET"], [`${base}/meads`, "POST"], [`${base}/meads/${id}`, "PATCH"],
    [`${base}/organization`, "PATCH"], [`${base}/storage/${id}`, "GET"], [`${base}/storage/${id}`, "PATCH"]
  ]);
});
