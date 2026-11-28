import assert from "node:assert/strict";
import test from "node:test";

import { createMeadToolsApiClient, MeadToolsContractError, type ApiRequestInit } from "../src/index";

test("reads stock history and sends validated creation and adjustment commands to the existing API", async () => {
  const stockId = "7dc4446a-d7f0-45a4-bc9b-2a0aa14b0563";
  const operationId = "94d08cb3-c82b-4d65-b290-512dbf72502d";
  const balance = { value: 3, unit: "kg" } as const;
  const draft = { name: "Honey", category: "honey", quantity: balance, notes: null, catalogReference: null } as const;
  const requests: { url: string; init: ApiRequestInit }[] = [];
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test",
    fetch: async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        status: init.method === "POST" ? 201 : 200,
        json: async () => init.method === "GET"
          ? { stock: { ...draft, id: stockId, reconciliation_required: false }, adjustments: [], has_more: false }
          : { stockId, balance }
      };
    }
  });
  const route = "https://meadtools.test/api/account/inventory";
  const create = { operation_id: operationId, stock: draft, price: null };
  const update = {
    action: "manual_use", operation_id: operationId, quantity: { ...balance, value: 1 },
    expected_balance: balance, note: null
  } as const;

  assert.equal((await client.getInventoryStock(stockId)).stock.id, stockId);
  assert.deepEqual(await client.createInventoryStock(create), { stockId, balance });
  assert.deepEqual(await client.updateInventoryStock(stockId, update), { stockId, balance });
  await assert.rejects(client.updateInventoryStock(stockId, { ...update, operation_id: "bad-id" }), MeadToolsContractError);

  assert.deepEqual(requests.map(({ url, init }) => [url, init.method, init.body && JSON.parse(init.body)]), [
    [`${route}/${stockId}`, "GET", undefined],
    [route, "POST", create],
    [`${route}/${stockId}`, "PATCH", update]
  ]);
});
