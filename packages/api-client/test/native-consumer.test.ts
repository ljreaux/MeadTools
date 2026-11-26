import assert from "node:assert/strict";
import test from "node:test";

import {
  createMeadToolsApiClient,
  MeadToolsApiError,
  MeadToolsContractError,
  type ApiRequestInit
} from "../src/index";

const clientEntryId = "00000000-0000-4000-8000-000000000001";

test("account profile reads only profile fields and patches username and avatar independently", async () => {
  const requests: ApiRequestInit[] = [];
  const user = {
    email: "maker@example.com",
    isGoogleUser: true,
    public_username: null,
    google_avatar_url: "https://example.com/avatar.png",
    show_google_avatar: false
  };
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.example",
    getAccessToken: () => "access-token",
    fetch: async (url, init) => {
      assert.equal(url, "https://meadtools.example/api/auth/account-info");
      assert.equal(init.headers.authorization, "Bearer access-token");
      requests.push(init);
      const extra = { hydro_token: "private", google_id: "provider-id" };
      return {
        ok: true,
        status: 200,
        json: async () => init.method === "GET"
          ? { user: { ...user, ...extra }, recipes: [] }
          : { ...user, ...extra, ...JSON.parse(init.body ?? "{}") }
      };
    }
  });

  assert.deepEqual(await client.getAccountProfile(), user);
  assert.deepEqual(await client.updateAccountProfile({ public_username: "  Maker  " }), {
    public_username: "Maker", show_google_avatar: false
  });
  assert.deepEqual(await client.updateAccountProfile({ show_google_avatar: false }), {
    public_username: null, show_google_avatar: false
  });
  await assert.rejects(client.updateAccountProfile({ public_username: "  " }), MeadToolsContractError);
  await assert.rejects(client.updateAccountProfile({}), MeadToolsContractError);
  assert.deepEqual(requests.map(({ method, body }) => [method, body]), [
    ["GET", undefined],
    ["PATCH", '{"public_username":"Maker"}'],
    ["PATCH", '{"show_google_avatar":false}']
  ]);
});

const accountRecipe = {
  id: 12,
  user_id: 7,
  name: "Traditional",
  recipeData: "",
  yanFromSource: null,
  yanContribution: "",
  nutrientData: "",
  advanced: false,
  nuteInfo: null,
  primaryNotes: [],
  secondaryNotes: [],
  dataV2: null,
  version: 2,
  private: true,
  lastActivityEmailAt: null,
  activityEmailsEnabled: false,
  users: { public_username: "maker" },
  public_username: "maker"
};

const brewListItem = {
  id: "brew-1",
  name: "Traditional batch",
  start_date: "2026-07-03T12:00:00.000Z",
  end_date: null,
  stage: "PRIMARY",
  batch_number: 1,
  current_volume_liters: 18.9,
  requested_email_alerts: false,
  gravity_unit_preference: "SG",
  public: false,
  recipe_id: 12,
  recipe_name: "Traditional",
  recipe_private: true,
  entry_count: 0,
  latest_gravity: null,
  cover_image_id: null
};

function brewDetail(entries: unknown[] = []) {
  return {
    ...brewListItem,
    entry_count: entries.length,
    recipe_snapshot: null,
    entries,
    entries_by_stage: [
      {
        stage: "PRIMARY",
        entries
      }
    ]
  };
}

test("standalone consumer reads recipes/brews and retries one entry safely", async () => {
  const storedEntries = new Map<string, Record<string, unknown>>();
  const requests: Array<{ url: string; init: ApiRequestInit }> = [];
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.example",
    getAccessToken: () => "access-token",
    fetch: async (url, init) => {
      requests.push({ url, init });

      if (url.endsWith("/api/auth/account-info")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            user: {
              id: 7,
              email: "maker@example.com",
              google_id: null,
              role: "user",
              hydro_token: null,
              public_username: "maker",
              google_avatar_url: null,
              show_google_avatar: false,
              active: true,
              isGoogleUser: false
            },
            recipes: [accountRecipe]
          })
        };
      }

      if (url.endsWith("/api/brews") && init.method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ brews: [brewListItem] })
        };
      }

      if (url.endsWith("/api/brews/brew-1") && init.method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => brewDetail()
        };
      }

      if (url.endsWith("/api/brews/brew-1/entries")) {
        const input = JSON.parse(init.body ?? "{}") as {
          client_entry_id: string;
          type: string;
          note: string;
        };
        if (!storedEntries.has(input.client_entry_id)) {
          storedEntries.set(input.client_entry_id, {
            id: input.client_entry_id,
            datetime: "2026-07-03T12:30:00.000Z",
            type: input.type,
            title: null,
            note: input.note,
            gravity: null,
            temperature: null,
            temp_units: null,
            data: null,
            user_id: 7
          });
        }

        return {
          ok: true,
          status: 201,
          json: async () => ({
            brew: brewDetail(Array.from(storedEntries.values()))
          })
        };
      }

      throw new Error(`Unexpected request: ${init.method} ${url}`);
    }
  });

  const recipes = await client.listRecipes();
  const brews = await client.listBrews();
  const brew = await client.getBrew("brew-1");
  const input = {
    client_entry_id: clientEntryId,
    type: "NOTE" as const,
    note: "Queued offline"
  };
  const created = await client.createBrewEntry("brew-1", input);
  const retried = await client.createBrewEntry("brew-1", input);

  assert.equal(recipes[0].id, 12);
  assert.equal(brews[0].id, "brew-1");
  assert.equal(brew.id, "brew-1");
  assert.equal(created.entries.length, 1);
  assert.equal(retried.entries.length, 1);
  assert.equal(retried.entries[0].id, clientEntryId);
  assert.equal(storedEntries.size, 1);
  assert.equal(
    requests.every(
      ({ init }) => init.headers.authorization === "Bearer access-token"
    ),
    true
  );
});

test("mobile brew detail accepts a legacy snapshot and exposes not-found status", async () => {
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.example",
    fetch: async (url) => url.endsWith("/brew-1")
      ? {
          ok: true,
          status: 200,
          json: async () => ({
            ...brewDetail(),
            recipe_snapshot: { name: "Original recipe", dataV2: { version: 1 } }
          })
        }
      : {
          ok: false,
          status: 404,
          json: async () => ({ error: "Brew not found" })
        }
  });

  const detail = await client.getBrew("brew-1");
  assert.equal(detail.recipe_snapshot?.name, "Original recipe");
  await assert.rejects(client.getBrew("missing"), (error) => {
    assert.ok(error instanceof MeadToolsApiError);
    assert.equal(error.status, 404);
    return true;
  });
});

test("client rejects an invalid client entry UUID before transport", async () => {
  let called = false;
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.example",
    fetch: async () => {
      called = true;
      throw new Error("transport should not be called");
    }
  });

  await assert.rejects(
    client.createBrewEntry("brew-1", {
      client_entry_id: "not-a-uuid",
      type: "NOTE",
      note: "Invalid"
    }),
    MeadToolsContractError
  );
  assert.equal(called, false);
});

test("mobile reads stock and edits or deletes entries through the shared contract", async () => {
  const stockId = "00000000-0000-4000-8000-0000000000aa";
  const requests: Array<{ url: string; init: ApiRequestInit }> = [];
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.example",
    getAccessToken: () => "access-token",
    fetch: async (url, init) => {
      requests.push({ url, init });
      if (url.endsWith("/api/account/inventory")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            can_manage: true,
            stock: [{
              id: stockId,
              name: "Wildflower honey",
              category: "honey",
              catalogReference: null,
              quantity: { value: 12, unit: "lb" },
              notes: null,
              reconciliation_required: false
            }]
          })
        };
      }
      if (init.method === "PATCH") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            entry: {
              id: clientEntryId,
              brew_id: "brew-1",
              datetime: "2026-07-03T12:30:00.000Z",
              type: "NOTE",
              title: null,
              note: "Edited",
              gravity: null,
              temperature: null,
              temp_units: null,
              data: null,
              user_id: 7
            }
          })
        };
      }
      if (init.method === "DELETE" && url.endsWith("/linked")) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: "Review the inventory deduction before changing this use", code: "SELECTION_REQUIRED" })
        };
      }
      if (init.method === "DELETE") {
        return { ok: true, status: 200, json: async () => ({ message: "Entry deleted successfully." }) };
      }
      throw new Error(`Unexpected request: ${init.method} ${url}`);
    }
  });

  const overview = await client.getInventoryOverview();
  assert.equal(overview.can_manage, true);
  assert.equal(overview.stock[0].quantity.unit, "lb");
  assert.deepEqual(overview.cost_exclusions, []);

  const updated = await client.updateBrewEntry("brew-1", clientEntryId, { note: "Edited" });
  assert.equal(updated.entry?.note, "Edited");
  assert.equal(requests.at(-1)?.init.method, "PATCH");
  assert.deepEqual(JSON.parse(requests.at(-1)?.init.body ?? "{}"), { note: "Edited" });

  const removed = await client.deleteBrewEntry("brew-1", clientEntryId);
  assert.equal(removed.message, "Entry deleted successfully.");
  assert.ok(requests.at(-1)?.url.endsWith(`/api/brews/brew-1/entries/${clientEntryId}`));

  // An inventory-linked entry needs the web's review flow; the code is kept.
  await assert.rejects(client.deleteBrewEntry("brew-1", "linked"), (error) => {
    assert.ok(error instanceof MeadToolsApiError);
    assert.equal(error.status, 409);
    assert.equal((error.body as { code: string }).code, "SELECTION_REQUIRED");
    return true;
  });

  // Invalid edits are rejected before transport.
  const before = requests.length;
  await assert.rejects(
    client.updateBrewEntry("brew-1", clientEntryId, { gravity: "1.050" as unknown as number }),
    MeadToolsContractError
  );
  assert.equal(requests.length, before);
});
