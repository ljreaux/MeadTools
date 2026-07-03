import assert from "node:assert/strict";
import test from "node:test";

import {
  createMeadToolsApiClient,
  MeadToolsContractError,
  type ApiRequestInit
} from "../src/index";

const clientEntryId = "00000000-0000-4000-8000-000000000001";

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
  latest_gravity: null
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
