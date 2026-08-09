import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baselineCanonicalSha256 =
  "e8e5b255fcb24a1aeb930f8e55698be7e6484acee0e5245ee3feb30b3e546f2e";
const preZodPathsCanonicalSha256 =
  "5474c09299fc8dbcd5bb25a54559d9bd19cca3dec0b0ee22f05f302dab0a7aa3";

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, sortJson(child)])
  );
}

test("generated OpenAPI document matches the reviewed Zod baseline", async () => {
  const documentUrl = new URL(
    "../../../apps/web/public/openapi.json",
    import.meta.url
  );
  const document = JSON.parse(await readFile(documentUrl, "utf8")) as unknown;
  const canonicalDocument = JSON.stringify(sortJson(document));
  const actualHash = createHash("sha256")
    .update(canonicalDocument)
    .digest("hex");

  assert.equal(
    actualHash,
    baselineCanonicalSha256,
    "OpenAPI output changed; review the generated document before updating the baseline"
  );
});

test("approved API additions preserve all pre-existing endpoint documentation", async () => {
  const documentUrl = new URL(
    "../../../apps/web/public/openapi.json",
    import.meta.url
  );
  const document = JSON.parse(await readFile(documentUrl, "utf8")) as {
    paths: Record<
      string,
      { post?: { responses?: Record<string, unknown> } }
    >;
  };
  const pathsWithoutApprovedAdditions = structuredClone(document.paths);
  delete pathsWithoutApprovedAdditions["/brews/{brew_id}/entries"]?.post
    ?.responses?.["409"];
  delete pathsWithoutApprovedAdditions["/nutrient-presets"];
  delete pathsWithoutApprovedAdditions["/chat/context"];
  delete pathsWithoutApprovedAdditions["/chat/recipe"];
  delete pathsWithoutApprovedAdditions["/chat/conversations"];
  delete pathsWithoutApprovedAdditions["/chat/conversations/{conversationId}"];
  delete pathsWithoutApprovedAdditions["/account/credits"];
  delete pathsWithoutApprovedAdditions["/account/credits/checkout"];
  delete pathsWithoutApprovedAdditions["/account/credits/history"];
  delete pathsWithoutApprovedAdditions["/webhooks/stripe"];
  delete pathsWithoutApprovedAdditions["/chat/access"];
  delete pathsWithoutApprovedAdditions["/admin/chat-access"];
  delete pathsWithoutApprovedAdditions["/admin/chat-access/grants"];
  delete pathsWithoutApprovedAdditions["/admin/chat-access/grants/{userId}"];
  delete pathsWithoutApprovedAdditions["/admin/chat-access/credits"];
  delete pathsWithoutApprovedAdditions["/admin/chat-access/payment-recoveries"];
  delete pathsWithoutApprovedAdditions["/admin/chat-access/payment-recoveries/{recoveryId}"];
  const canonicalPaths = JSON.stringify(
    sortJson(pathsWithoutApprovedAdditions)
  );
  const actualHash = createHash("sha256")
    .update(canonicalPaths)
    .digest("hex");

  assert.equal(actualHash, preZodPathsCanonicalSha256);
});
