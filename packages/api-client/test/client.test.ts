import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getRecipeResponseSchema } from "@meadtools/api-contract";
import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";
import type { RecipeDataV2Input } from "@meadtools/api-contract";
import {
  createMeadToolsApiClient,
  MeadToolsApiError,
  MeadToolsContractError,
  type ApiRequestInit
} from "../src/index";

test("logs in and validates refresh responses through the shared contract", async () => {
  const requests: Array<{ url: string; init: ApiRequestInit }> = [];
  const responses = [
    {
      message: "Successfully logged in!",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      role: "user",
      email: "brewer@example.com",
      id: 42
    },
    { accessToken: "refreshed-access-token" }
  ];
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test/",
    fetch: async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => responses.shift()
      };
    }
  });

  const session = await client.login({
    email: "brewer@example.com",
    password: "secret"
  });
  const refreshed = await client.refreshAccessToken({
    email: session.email,
    refreshToken: session.refreshToken
  });

  assert.equal(session.id, 42);
  assert.equal(refreshed.accessToken, "refreshed-access-token");
  assert.deepEqual(
    requests.map(({ url, init }) => [url, init.method]),
    [
      ["https://meadtools.test/api/auth/login", "POST"],
      ["https://meadtools.test/api/auth/refresh", "POST"]
    ]
  );
});

test("exchanges a Google ID token for a refreshable MeadTools session", async () => {
  let request: { url: string; init: ApiRequestInit } | undefined;
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test",
    fetch: async (url, init) => {
      request = { url, init };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          token: "access-token",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          user: {
            id: 42,
            email: "brewer@example.com",
            role: "user"
          }
        })
      };
    }
  });

  const session = await client.signInWithGoogle("google-id-token");

  assert.equal(session.refreshToken, "refresh-token");
  assert.deepEqual(request, {
    url: "https://meadtools.test/api/auth/verify-token",
    init: {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        token: "google-id-token",
        provider: "google"
      })
    }
  });
});

const recipe: RecipeDataV2Input = {
  version: 2,
  unitDefaults: { weight: "lb", volume: "gal" },
  ingredients: [
    {
      lineId: "water",
      name: "Water",
      ref: { kind: "custom" },
      category: "water",
      brix: "0",
      secondary: false,
      amounts: {
        weight: { value: "0", unit: "lb" },
        volume: { value: "1", unit: "gal" },
        basis: "volume"
      }
    }
  ],
  fg: "1",
  additives: [],
  stabilizers: {
    adding: false,
    takingPh: false,
    phReading: "3.5",
    type: "kmeta"
  },
  notes: { primary: [], secondary: [] }
};

test("posts recipe data and returns the validated derived response unchanged", async () => {
  const expected = calculateRecipeDerivedApiResponse(recipe);
  let request:
    | {
        url: string;
        init: ApiRequestInit;
      }
    | undefined;
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.example/",
    fetch: async (url, init) => {
      request = { url, init };
      return {
        ok: true,
        status: 200,
        json: async () => expected
      };
    }
  });

  const actual = await client.calculateRecipeDerived(recipe);

  assert.deepEqual(actual, expected);
  assert.deepEqual(request, {
    url: "https://meadtools.example/api/recipes/derived",
    init: {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(recipe)
    }
  });
});

test("throws a typed API error for a non-success response", async () => {
  const body = { error: "Invalid recipe data payload." };
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.example",
    fetch: async () => ({
      ok: false,
      status: 400,
      json: async () => body
    })
  });

  await assert.rejects(
    client.calculateRecipeDerived(recipe),
    (error: unknown) => {
      assert.ok(error instanceof MeadToolsApiError);
      assert.equal(error.status, 400);
      assert.equal(error.message, body.error);
      assert.deepEqual(error.body, body);
      return true;
    }
  );
});

test("resolves the current bearer token for each request", async () => {
  const expected = calculateRecipeDerivedApiResponse(recipe);
  const tokens = ["first-token", "second-token"];
  const authorizationHeaders: Array<string | undefined> = [];
  const client = createMeadToolsApiClient({
    baseUrl: "",
    getAccessToken: async () => tokens.shift(),
    fetch: async (url, init) => {
      assert.equal(url, "/api/recipes/derived");
      authorizationHeaders.push(init.headers.authorization);
      return {
        ok: true,
        status: 200,
        json: async () => expected
      };
    }
  });

  await client.calculateRecipeDerived(recipe);
  await client.calculateRecipeDerived(recipe);

  assert.deepEqual(authorizationHeaders, [
    "Bearer first-token",
    "Bearer second-token"
  ]);
});

test("reports a non-JSON error response without hiding its HTTP status", async () => {
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.example///",
    fetch: async (url) => {
      assert.equal(url, "https://meadtools.example/api/recipes/derived");
      return {
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        }
      };
    }
  });

  await assert.rejects(
    client.calculateRecipeDerived(recipe),
    (error: unknown) => {
      assert.ok(error instanceof MeadToolsApiError);
      assert.equal(error.status, 502);
      assert.equal(
        error.message,
        "MeadTools API request failed with status 502"
      );
      assert.equal(error.body, undefined);
      return true;
    }
  );
});

test("rejects an invalid response instead of returning untrusted data", async () => {
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.example",
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ recipeData: recipe })
    })
  });

  await assert.rejects(
    client.calculateRecipeDerived(recipe),
    MeadToolsContractError
  );
});

test("rejects invalid recipe data before calling the transport", async () => {
  let called = false;
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.example",
    fetch: async () => {
      called = true;
      throw new Error("transport should not be called");
    }
  });
  const invalidRecipe = { ...recipe, version: 1 };

  await assert.rejects(
    client.calculateRecipeDerived(
      invalidRecipe as unknown as RecipeDataV2Input
    ),
    MeadToolsContractError
  );
  assert.equal(called, false);
});

test("reads the existing inventory context, finished meads, and locations for a bottling review", async () => {
  const requests: Array<{ url: string; init: ApiRequestInit }> = [];
  const context = { can_manage: false, tracked_entry_ids: [], usages: [], vessel_events: [] };
  const meads = { can_manage: false, meads: [] };
  const organization = { can_manage: false, labels: [], locations: [], stock: [], assignments: [] };
  const responses = [context, meads, organization, { can_manage: true }];
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test",
    getAccessToken: () => "test-access",
    fetch: async (url, init) => {
      requests.push({ url, init });
      return { ok: true, status: 200, json: async () => responses.shift() };
    }
  });
  assert.deepEqual((await client.getBrewInventory("test/brew")).bottlings, []);
  assert.deepEqual(await client.getFinishedMeads(), meads);
  assert.deepEqual((await client.getInventoryOrganization()).locations, []);
  await assert.rejects(() => client.getBrewInventory("test/brew"), MeadToolsContractError);
  assert.deepEqual(requests.slice(0, 3).map(({ url, init }) => [new URL(url).pathname, init.method, init.headers.authorization]), [
    ["/api/brews/test%2Fbrew/inventory", "GET", "Bearer test-access"],
    ["/api/account/inventory/meads", "GET", "Bearer test-access"],
    ["/api/account/inventory/organization", "GET", "Bearer test-access"]
  ]);
});

test("reads the public catalogs the calculators use and validates each list", async () => {
  const bodies: Record<string, unknown> = {
    "https://meadtools.test/api/yeasts": [
      { id: 1, brand: "Lalvin", name: "71B", nitrogen_requirement: "Low", tolerance: "14", low_temp: "59", high_temp: "86" }
    ],
    "https://meadtools.test/api/ingredients": [
      { id: 7, name: "Honey", sugar_content: "79.6", water_content: "15.5", category: "sugar" }
    ],
    "https://meadtools.test/api/nutrient-presets": [
      { id: "0f6c1d0e-6a53-4a5e-9d0e-6f0f2c1b7a11", name: "Fermaid O", yan_ppm_per_gpl: 40, max_gpl: null, organic_multiplier: true }
    ]
  };
  const requests: string[] = [];
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test",
    fetch: async (url, init) => {
      requests.push(`${init.method} ${url}`);
      return { ok: true, status: 200, json: async () => bodies[url] };
    }
  });

  assert.equal((await client.listYeasts())[0].name, "71B");
  assert.equal((await client.listIngredients())[0].sugar_content, "79.6");
  assert.equal((await client.listNutrientPresets())[0].max_gpl, null);
  assert.deepEqual(requests, [
    "GET https://meadtools.test/api/yeasts",
    "GET https://meadtools.test/api/ingredients",
    "GET https://meadtools.test/api/nutrient-presets"
  ]);

  bodies["https://meadtools.test/api/yeasts"] = { error: "not a list" };
  await assert.rejects(client.listYeasts(), MeadToolsContractError);
});

test("starts a brew from a recipe and validates the created brew", async () => {
  const created = {
    id: "2b1f0a52-7c1e-4a43-9d6c-5d8e0f2a9b11",
    name: "January batch",
    start_date: "2026-11-21T02:27:00.561Z",
    end_date: null,
    stage: "PLANNED",
    batch_number: 2,
    current_volume_liters: null,
    requested_email_alerts: false,
    gravity_unit_preference: "SG",
    public: false,
    latest_gravity: null,
    cover_image_id: null,
    recipe_id: 4,
    recipe_name: "Mead Wiki Simple Trad Metric",
    recipe_private: false,
    entry_count: 0
  };
  const requests: Array<{ url: string; method: string; body: unknown }> = [];
  let responseBody: unknown = { brew: created };
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test",
    fetch: async (url, init) => {
      requests.push({
        url,
        method: init.method,
        body: init.body ? JSON.parse(init.body) : undefined
      });
      return { ok: true, status: 201, json: async () => responseBody };
    }
  });

  assert.deepEqual(
    await client.createBrew({ recipe_id: 4, name: "January batch" }),
    created
  );
  assert.deepEqual(requests, [
    {
      url: "https://meadtools.test/api/brews",
      method: "POST",
      body: { recipe_id: 4, name: "January batch" }
    }
  ]);

  await assert.rejects(
    client.createBrew({ recipe_id: "4" } as never),
    MeadToolsContractError
  );
  assert.equal(requests.length, 1);

  responseBody = { brew: { id: created.id } };
  await assert.rejects(
    client.createBrew({ recipe_id: 4 }),
    MeadToolsContractError
  );
});

test("updates brew settings and validates the request and response", async () => {
  const updated = {
    id: "2b1f0a52-7c1e-4a43-9d6c-5d8e0f2a9b11",
    name: "Spring batch",
    start_date: "2026-03-01T12:00:00.000Z",
    end_date: null,
    stage: "PLANNED",
    batch_number: 3,
    current_volume_liters: null,
    requested_email_alerts: true,
    gravity_unit_preference: "SG",
    public: false,
    latest_gravity: null,
    cover_image_id: null,
    recipe_id: 2,
    recipe_name: "Key Lime Pie",
    recipe_private: false
  };
  const requests: Array<{ url: string; method: string; body: unknown }> = [];
  let responseBody: unknown = updated;
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test",
    fetch: async (url, init) => {
      requests.push({
        url,
        method: init.method,
        body: init.body ? JSON.parse(init.body) : undefined
      });
      return { ok: true, status: 200, json: async () => responseBody };
    }
  });

  const input = {
    name: "Spring batch",
    batch_number: 3,
    start_date: "2026-03-01T12:00:00.000Z",
    requested_email_alerts: true
  };
  assert.deepEqual(await client.updateBrew("brew/1", input), updated);
  assert.deepEqual(requests, [
    { url: "https://meadtools.test/api/brews/brew%2F1", method: "PATCH", body: input }
  ]);

  await client.updateBrew("brew-1", { batch_number: null });
  assert.deepEqual(requests[1].body, { batch_number: null });

  for (const invalid of [{ batch_number: 0 }, { batch_number: 1.5 }, { start_date: "March" }]) {
    await assert.rejects(client.updateBrew("brew-1", invalid as never), MeadToolsContractError);
  }
  assert.equal(requests.length, 2);

  responseBody = { id: updated.id };
  await assert.rejects(client.updateBrew("brew-1", { public: true }), MeadToolsContractError);
});

test("reads a recipe and deletes a brew through the shared contract", async () => {
  const recipe = {
    id: 2,
    user_id: 2,
    name: "Key Lime Pie",
    recipeData: "[]",
    yanFromSource: null,
    yanContribution: "[]",
    nutrientData: "{}",
    advanced: false,
    nuteInfo: null,
    primaryNotes: [],
    secondaryNotes: [],
    dataV2: null,
    version: 2,
    private: false,
    lastActivityEmailAt: null,
    activityEmailsEnabled: true,
    users: { public_username: "MeadTools User", active: true },
    ratings: [],
    public_username: "MeadTools User",
    averageRating: 4
  };
  const bodies: Record<string, unknown> = {
    "GET https://meadtools.test/api/recipes/2": { recipe },
    "DELETE https://meadtools.test/api/brews/brew%2F1": { message: "Brew deleted successfully." }
  };
  const requests: string[] = [];
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test",
    fetch: async (url, init) => {
      requests.push(`${init.method} ${url}`);
      return { ok: true, status: 200, json: async () => bodies[`${init.method} ${url}`] };
    }
  });

  assert.equal((await client.getRecipe(2)).name, "Key Lime Pie");

  assert.deepEqual(await client.deleteBrew("brew/1"), { message: "Brew deleted successfully." });
  assert.deepEqual(requests, [
    "GET https://meadtools.test/api/recipes/2",
    "DELETE https://meadtools.test/api/brews/brew%2F1"
  ]);

  // The plan comes back as stored. The contract parse would turn the seeded
  // recipe's numeric YAN contributions into strings, which never matches a
  // brew snapshot of the same plan.
  const storedPlan = JSON.parse(
    readFileSync(new URL("./fixtures/stored-recipe-plan.json", import.meta.url), "utf8")
  );
  bodies["GET https://meadtools.test/api/recipes/2"] = { recipe: { ...recipe, dataV2: storedPlan } };
  assert.deepEqual((await client.getRecipe(2)).dataV2, storedPlan);
  assert.notDeepEqual(
    getRecipeResponseSchema.parse({ recipe: { ...recipe, dataV2: storedPlan } }).recipe.dataV2,
    storedPlan
  );

  bodies["GET https://meadtools.test/api/recipes/2"] = { recipe: { id: 2 } };
  await assert.rejects(client.getRecipe(2), MeadToolsContractError);
  bodies["DELETE https://meadtools.test/api/brews/brew%2F1"] = { message: "ok" };
  await assert.rejects(client.deleteBrew("brew/1"), MeadToolsContractError);
});

test("reads recipe covers and temporary photo access through authenticated endpoints", async () => {
  const imageId = "20000000-0000-4000-8000-000000000001";
  const image = {
    id: imageId,
    caption: "Recipe cover",
    entry_id: null,
    entry_title: null,
    entry_datetime: null,
    entry_hidden: false,
    width: 800,
    height: 450,
    size_bytes: 1200,
    created_at: "2026-11-25T00:00:00.000Z"
  };
  const access = {
    url: "https://storage.example.test/cover.webp",
    expires_at: "2026-11-25T00:01:00.000Z"
  };
  const paths: string[] = [];
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test",
    getAccessToken: () => "test-token",
    fetch: async (url, init) => {
      assert.equal(init.headers.authorization, "Bearer test-token");
      assert.equal(init.method, "GET");
      const path = new URL(url).pathname + new URL(url).search;
      paths.push(path);
      const body = path === "/api/recipes/7/cover"
        ? { image, can_set: false }
        : path === "/api/recipes/8/cover"
          ? { image: null, can_set: false }
          : access;
      return { ok: true, status: 200, json: async () => body };
    }
  });

  assert.deepEqual(await client.getRecipeCover(7), image);
  assert.equal(await client.getRecipeCover(8), null);
  assert.deepEqual(await client.getRecipeImageAccess(7, imageId), access);
  assert.deepEqual(paths, [
    "/api/recipes/7/cover",
    "/api/recipes/8/cover",
    `/api/recipes/7/images/${imageId}`
  ]);
});

test("uses the signed-in recipe cost estimate and rejects a public summary response", async () => {
  const estimate = {
    basis: "recipe_estimate",
    totals: [{ currency: "USD", amount: 8.75 }],
    complete: false,
    mixed_currencies: false,
    per_liter: 2.5,
    volume_liters: 3.5,
    lines: [],
    short_lines: 0,
    excluded_lines: 0,
    missing: { unpriced: 0, unmatched: 1, ambiguous: 0, incompatible: 0 }
  };
  const payloads = [
    { can_manage: true, share_cost_summary: false, estimate },
    { can_manage: false, share_cost_summary: false, estimate },
    { summary: null }
  ];
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test",
    getAccessToken: () => "test-token",
    fetch: async (url, init) => {
      assert.equal(url, "https://meadtools.test/api/recipes/42/costs");
      assert.equal(init.method, "GET");
      assert.equal(init.headers.authorization, "Bearer test-token");
      return { ok: true, status: 200, json: async () => payloads.shift() };
    }
  });

  assert.deepEqual(await client.getRecipeCosts(42), {
    can_manage: true,
    share_cost_summary: false,
    estimate
  });
  assert.equal((await client.getRecipeCosts(42)).can_manage, false);
  await assert.rejects(() => client.getRecipeCosts(42), MeadToolsContractError);
});

test("downloads a saved recipe PDF with owner authentication and validates the filename", async () => {
  const base64 = Buffer.from("%PDF-1.3\n").toString("base64");
  const payloads = [
    { filename: "key-lime-pie.pdf", base64 },
    { filename: "../key-lime-pie.pdf", base64 }
  ];
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test",
    getAccessToken: () => "test-token",
    fetch: async (url, init) => {
      assert.equal(url, "https://meadtools.test/api/recipes/42/pdf?locale=de");
      assert.equal(init.method, "GET");
      assert.equal(init.headers.authorization, "Bearer test-token");
      return { ok: true, status: 200, json: async () => payloads.shift() };
    }
  });
  assert.deepEqual(await client.getRecipePdf(42, "de"), { filename: "key-lime-pie.pdf", base64 });
  await assert.rejects(() => client.getRecipePdf(42, "de"), MeadToolsContractError);
});
