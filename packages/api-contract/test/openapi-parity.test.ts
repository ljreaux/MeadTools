import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baselineCanonicalSha256 =
  "f3f5399fa6c58ea3d34342e5c95de8b2a5a7b7d6f57dc5c9924b6441b5a92933";
const preZodPathsCanonicalSha256 =
  "5474c09299fc8dbcd5bb25a54559d9bd19cca3dec0b0ee22f05f302dab0a7aa3";

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

test("approved API additions preserve all pre-existing endpoint documentation", async () => {
  const documentUrl = new URL(
    "../../../apps/web/public/openapi.json",
    import.meta.url,
  );
  const document = JSON.parse(await readFile(documentUrl, "utf8")) as {
    paths: Record<string, {
      get?: { responses?: Record<string, unknown> };
      post?: { description?: string; parameters?: unknown[]; responses?: Record<string, unknown> };
      patch?: { responses?: Record<string, unknown> };
      delete?: { requestBody?: unknown; responses?: Record<string, unknown> };
    }>;
  };
  const pathsWithoutApprovedAdditions = structuredClone(document.paths);
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
  delete pathsWithoutApprovedAdditions["/account/inventory"];
  delete pathsWithoutApprovedAdditions["/account/inventory/transfer"];
  delete pathsWithoutApprovedAdditions["/account/inventory/{stock_id}"];
  delete pathsWithoutApprovedAdditions["/account/equipment"];
  delete pathsWithoutApprovedAdditions["/account/equipment/{equipment_id}"];
  delete pathsWithoutApprovedAdditions["/chat/context"];
  delete pathsWithoutApprovedAdditions["/chat/recipe"];
  delete pathsWithoutApprovedAdditions["/chat/conversations"];
  delete pathsWithoutApprovedAdditions["/chat/conversations/{conversationId}"];
  delete pathsWithoutApprovedAdditions["/account/credits"];
  delete pathsWithoutApprovedAdditions["/account/credits/checkout"];
  delete pathsWithoutApprovedAdditions["/account/credits/history"];
  delete pathsWithoutApprovedAdditions["/account/premium"];
  delete pathsWithoutApprovedAdditions["/account/premium/kofi/link"];
  delete pathsWithoutApprovedAdditions["/account/premium/kofi/claim"];
  delete pathsWithoutApprovedAdditions["/account/premium/mcp/tokens"];
  delete pathsWithoutApprovedAdditions["/account/premium/mcp/tokens/{id}"];
  delete pathsWithoutApprovedAdditions["/account/premium/stripe/checkout"];
  delete pathsWithoutApprovedAdditions["/account/premium/stripe/portal"];
  delete pathsWithoutApprovedAdditions["/account/release-emails"];
  delete pathsWithoutApprovedAdditions["/release-emails/unsubscribe"];
  delete pathsWithoutApprovedAdditions["/webhooks/stripe"];
  delete pathsWithoutApprovedAdditions["/webhooks/kofi"];
  delete pathsWithoutApprovedAdditions["/chat/access"];
  delete pathsWithoutApprovedAdditions["/admin/chat-access"];
  delete pathsWithoutApprovedAdditions["/admin/chat-access/grants"];
  delete pathsWithoutApprovedAdditions["/admin/chat-access/grants/{userId}"];
  delete pathsWithoutApprovedAdditions["/admin/chat-access/credits"];
  delete pathsWithoutApprovedAdditions["/admin/chat-access/payment-recoveries"];
  delete pathsWithoutApprovedAdditions[
    "/admin/chat-access/payment-recoveries/{recoveryId}"
  ];
  delete pathsWithoutApprovedAdditions["/admin/chat/usage"];
  delete pathsWithoutApprovedAdditions["/brews/{brew_id}/entries/batch"];
  const canonicalPaths = JSON.stringify(
    sortJson(pathsWithoutApprovedAdditions),
  );
  const actualHash = createHash("sha256").update(canonicalPaths).digest("hex");

  assert.equal(actualHash, preZodPathsCanonicalSha256);
});
