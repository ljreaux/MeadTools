import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baselineCanonicalSha256 =
  "255cacfbda1651afe1d948c4cab574035a351e9c46b03c38cab9b803c40a6c3c";
const retainedHistoricalPathsCanonicalSha256 =
  "04af6c89cd661d8d14053ee217d9121e02a835ba0241109c2bb55b21ec2d347e";

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, sortJson(child)]),
  );
}

test("inventory OpenAPI uses actual shared quantity definitions and an optional DELETE body", async () => {
  const document = JSON.parse(await readFile(new URL("../../../apps/web/public/openapi.json", import.meta.url), "utf8"));
  const schemas = document.components.schemas;
  const selection = schemas.BrewInventorySelection.oneOf.find((branch: { properties: { mode: { enum: string[] } } }) =>
    branch.properties.mode.enum.includes("deduct"));
  const quantity = selection.properties.expected.properties.deducted;
  assert.equal(quantity.properties.value.type, "number");
  assert.equal(quantity.properties.value.minimum, 0);
  assert.equal(quantity.properties.value.maximum, 1_000_000_000);
  assert.equal(quantity.properties.unit.type, "string");
  assert.ok(quantity.properties.unit.enum.includes("kg"));
  assert.ok(quantity.properties.unit.enum.includes("mL"));
  assert.equal(selection.required.includes("expected"), false);
  assert.equal(schemas.BrewInventoryErrorResponse.properties.unit.type, "string");
  const body = document.paths["/brews/{brew_id}/entries/{entry_id}"].delete.requestBody;
  assert.equal(body.required, false);
  assert.ok(schemas.DeleteBrewEntryRequestBody);
});

test("public OpenAPI excludes operational, hosted chat, and app-only account routes", async () => {
  const document = JSON.parse(await readFile(new URL("../../../apps/web/public/openapi.json", import.meta.url), "utf8"));

  const internalNamespace = /^\/(?:admin|webhooks|cron|chat)(?:\/|$)|^\/account\/(?:credits|premium|release-emails)(?:\/|$)/;
  assert.deepEqual(Object.keys(document.paths).filter((path) => internalNamespace.test(path)), []);
  assert.equal(document.paths["/release-emails/unsubscribe"], undefined);

  for (const path of ["/auth/login", "/account/equipment", "/account/inventory", "/account/inventory/meads"]) {
    assert.ok(document.paths[path], `${path} should remain available in the public reference`);
  }
});

test("public OpenAPI excludes staff methods and retains public methods on shared paths", async () => {
  const document = JSON.parse(await readFile(new URL("../../../apps/web/public/openapi.json", import.meta.url), "utf8"));
  assert.equal(document.paths["/users"], undefined);
  assert.equal(document.paths["/users/{id}"], undefined);
  assert.deepEqual(Object.keys(document.paths["/recipes"]), ["post"]);
  for (const path of [
    "/additives", "/additives/{id}", "/bjcp-ingredients",
    "/ingredients", "/ingredients/{id}", "/yeasts", "/yeasts/{id}",
  ]) {
    assert.deepEqual(Object.keys(document.paths[path]), ["get"], path);
  }
  for (const pathItem of Object.values(document.paths) as Record<string, { tags?: string[] }>[]) {
    for (const operation of Object.values(pathItem)) {
      assert.ok(!operation.tags?.includes("Admin"));
    }
  }
});

test("every local OpenAPI reference resolves", async () => {
  const document = JSON.parse(await readFile(new URL("../../../apps/web/public/openapi.json", import.meta.url), "utf8")) as Record<string, unknown>;
  const unresolved = new Set<string>();

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref" && typeof child === "string" && child.startsWith("#")) {
        const pointer = decodeURIComponent(child.slice(1));
        if (!pointer) continue;
        if (!pointer.startsWith("/")) {
          unresolved.add(child);
          continue;
        }
        const tokens = pointer.slice(1).split("/");
        let target: unknown = document;
        for (const token of tokens) {
          const name = token.replace(/~1/g, "/").replace(/~0/g, "~");
          if (!target || typeof target !== "object" || !Object.hasOwn(target, name)) {
            unresolved.add(child);
            break;
          }
          target = (target as Record<string, unknown>)[name];
        }
      } else {
        visit(child);
      }
    }
  }

  visit(document);
  assert.deepEqual([...unresolved].sort(), []);
});

test("Tilt OpenAPI requires a query token and documents both request encodings", async () => {
  const document = JSON.parse(await readFile(new URL("../../../apps/web/public/openapi.json", import.meta.url), "utf8"));
  const { parameters, requestBody } = document.paths["/hydrometer/tilt"].post;
  assert.ok(parameters.some((param: { in: string; name: string; required: boolean }) =>
    param.in === "query" && param.name === "token" && param.required));
  assert.equal(requestBody.required, true);
  for (const contentType of ["application/json", "application/x-www-form-urlencoded"]) {
    assert.deepEqual(requestBody.content[contentType].schema, {
      $ref: "#/components/schemas/TiltIngestRequestBody",
    });
  }
});

test("account update OpenAPI exposes only allowed request fields and documents rejection", async () => {
  const document = JSON.parse(await readFile(new URL("../../../apps/web/public/openapi.json", import.meta.url), "utf8"));
  const body = document.components.schemas.UpdateAccountInfoRequestBody;
  assert.deepEqual(Object.keys(body.properties).sort(), [
    "email", "password", "public_username", "show_google_avatar",
  ]);
  assert.equal(body.additionalProperties, false);
  assert.deepEqual(
    document.paths["/auth/account-info"].patch.responses["400"].content["application/json"].schema,
    { $ref: "#/components/schemas/UpdateAccountInfoValidationErrorResponse" },
  );
});

test("generated OpenAPI document matches the reviewed Zod baseline", async () => {
  const documentUrl = new URL(
    "../../../apps/web/public/openapi.json",
    import.meta.url,
  );
  const document = JSON.parse(await readFile(documentUrl, "utf8")) as unknown;
  const canonicalDocument = JSON.stringify(sortJson(document));
  const actualHash = createHash("sha256")
    .update(canonicalDocument)
    .digest("hex");

  assert.equal(
    actualHash,
    baselineCanonicalSha256,
    "OpenAPI output changed; review the generated document before updating the baseline",
  );
});

test("approved API changes preserve the retained historical endpoint documentation", async () => {
  const documentUrl = new URL(
    "../../../apps/web/public/openapi.json",
    import.meta.url,
  );
  const document = JSON.parse(await readFile(documentUrl, "utf8")) as {
    paths: Record<string, {
      get?: { responses?: Record<string, unknown> };
      post?: {
        description?: string;
        parameters?: unknown[];
        requestBody?: { required?: boolean; content: Record<string, unknown> };
        responses?: Record<string, unknown>;
      };
      patch?: { description?: string; responses?: Record<string, unknown> };
      delete?: { description?: string; requestBody?: unknown; responses?: Record<string, unknown> };
    }>;
  };
  const pathsWithoutApprovedAdditions = structuredClone(document.paths);
  // Bottling adds private reviewed output selections to the existing entry writes.
  pathsWithoutApprovedAdditions["/brews/{brew_id}/entries"].post!.description = "Adds a timeline entry to a brew. STAGE_CHANGE entries are handled by updating the brew stage and return the refreshed brew.";
  pathsWithoutApprovedAdditions["/brews/{brew_id}/entries/{entry_id}"].patch!.description = "Updates a timeline entry for a brew. Stage change entries only allow datetime and note edits.";
  pathsWithoutApprovedAdditions["/brews/{brew_id}/entries/{entry_id}"].delete!.description = "Deletes a timeline entry for a brew. Stage change entries cannot be deleted through this endpoint.";
  delete pathsWithoutApprovedAdditions["/account/inventory/bottlings/{bottling_id}"];

  // Inventory keeps legacy requests valid and adds explicit deduction choices,
  // typed failures and an optional DELETE body. Compare older path docs below.
  for (const [path, method] of [
    ["/brews/{brew_id}/entries", "post"],
    ["/brews/{brew_id}/entries/{entry_id}", "patch"],
    ["/brews/{brew_id}/entries/{entry_id}", "delete"],
  ] as const) {
    const operation = pathsWithoutApprovedAdditions[path]?.[method];
    if (operation?.responses) {
      operation.responses["400"] = {
        description: "Bad Request",
        content: { "application/json": { schema: { $ref: "#/components/schemas/BrewValidationErrorResponse" } } },
      };
      operation.responses["404"] = {
        description: "Not Found",
        content: { "application/json": { schema: { $ref: "#/components/schemas/AuthenticatedRouteErrorResponse" } } },
      };
      delete operation.responses["403"];
      delete operation.responses["409"];
    }
  }
  delete pathsWithoutApprovedAdditions["/brews/{brew_id}/entries/{entry_id}"]?.delete?.requestBody;
  // Brew Streams add query authentication and envelope validation to this route.
  const raptCloud = pathsWithoutApprovedAdditions["/hydrometer/rapt-pill/cloud"]?.post;
  if (raptCloud) {
    raptCloud.description = "Intended for RAPT Pill cloud integrations to post readings to MeadTools. Writes a hydrometer log using the user's hydrometer token. Celsius temperatures are converted to Fahrenheit before storage.";
    raptCloud.parameters = [];
    if (raptCloud.responses) {
      raptCloud.responses["400"] = {
        description: "Bad Request",
        content: { "application/json": { schema: { $ref: "#/components/schemas/HydrometerAuthErrorResponse" } } },
      };
    }
  }
  // Tilt now documents the required query token and both accepted encodings.
  const tilt = pathsWithoutApprovedAdditions["/hydrometer/tilt"]?.post;
  if (tilt?.requestBody) {
    tilt.parameters = [{ in: "query", name: "token", schema: { type: "string" }, required: false }];
    delete tilt.requestBody.required;
    delete tilt.requestBody.content["application/x-www-form-urlencoded"];
  }
  // Invalid account updates now return a documented 400.
  delete pathsWithoutApprovedAdditions["/auth/account-info"]?.patch?.responses?.["400"];
  if (pathsWithoutApprovedAdditions["/brews/{brew_id}"]?.get?.responses) {
    pathsWithoutApprovedAdditions["/brews/{brew_id}"].get.responses["404"] = {
      description: "Not Found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/AuthenticatedRouteErrorResponse" }
        }
      }
    };
  }
  const brewCreate = pathsWithoutApprovedAdditions["/brews"]?.post;
  if (brewCreate) {
    brewCreate.description = "Starts a new brew from one of the authenticated user's recipes and snapshots the current recipe data.";
    if (brewCreate.responses) {
      brewCreate.responses["404"] = {
        description: "Not Found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AuthenticatedRouteErrorResponse" }
          }
        }
      };
    }
  }
  const metadata = pathsWithoutApprovedAdditions["/brews/{brew_id}"]?.patch;
  if (metadata?.responses) {
    metadata.responses["400"] = {description:"Bad Request",content:{"application/json":{schema:{$ref:"#/components/schemas/BrewValidationErrorResponse"}}}};
    metadata.responses["404"] = {description:"Not Found",content:{"application/json":{schema:{$ref:"#/components/schemas/AuthenticatedRouteErrorResponse"}}}};
  }
  delete pathsWithoutApprovedAdditions["/brews/{brew_id}"]?.patch?.responses?.["403"];
  delete pathsWithoutApprovedAdditions["/brews/{brew_id}"]?.patch?.responses?.["409"];
  delete pathsWithoutApprovedAdditions["/brews/{brew_id}/entries"]?.post
    ?.responses?.["409"];
  delete pathsWithoutApprovedAdditions["/nutrient-presets"];
  delete pathsWithoutApprovedAdditions["/brews/{brew_id}/inventory"];
  delete pathsWithoutApprovedAdditions["/brews/{brew_id}/cover"];
  delete pathsWithoutApprovedAdditions["/recipes/{id}/cover"];
  delete pathsWithoutApprovedAdditions["/recipes/{id}/images"];
  delete pathsWithoutApprovedAdditions["/recipes/{id}/images/{image_id}"];
  delete pathsWithoutApprovedAdditions["/brews/{brew_id}/images"];
  delete pathsWithoutApprovedAdditions["/brews/{brew_id}/images/{image_id}"];
  delete pathsWithoutApprovedAdditions["/account/inventory"];
  delete pathsWithoutApprovedAdditions["/account/inventory/transfer"];
  delete pathsWithoutApprovedAdditions["/account/inventory/{stock_id}"];
  delete pathsWithoutApprovedAdditions["/account/inventory/meads"];
  delete pathsWithoutApprovedAdditions["/account/inventory/meads/{mead_id}"];
  delete pathsWithoutApprovedAdditions["/account/inventory/organization"];
  delete pathsWithoutApprovedAdditions["/account/inventory/storage/{stock_id}"];
  // Ingredient costing (#513): private prices/estimates and opt-in public totals.
  delete pathsWithoutApprovedAdditions["/account/inventory/currency"];
  delete pathsWithoutApprovedAdditions["/account/inventory/cost-exclusions"];
  delete pathsWithoutApprovedAdditions["/brews/{brew_id}/costs"];
  delete pathsWithoutApprovedAdditions["/recipes/{id}/costs"];
  delete pathsWithoutApprovedAdditions["/account/equipment"];
  delete pathsWithoutApprovedAdditions["/account/equipment/{equipment_id}"];
  delete pathsWithoutApprovedAdditions["/brews/{brew_id}/entries/batch"];
  const canonicalPaths = JSON.stringify(
    sortJson(pathsWithoutApprovedAdditions),
  );
  const actualHash = createHash("sha256").update(canonicalPaths).digest("hex");

  assert.equal(actualHash, retainedHistoricalPathsCanonicalSha256);
});
