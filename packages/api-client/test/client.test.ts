import assert from "node:assert/strict";
import test from "node:test";
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
