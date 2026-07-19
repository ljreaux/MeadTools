import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baselineCanonicalSha256 =
  "b5da53654bc24a9c2b5016f18f5fcbba85864e1b6f2590fe72cbabcc10a6d7af";
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
  const canonicalPaths = JSON.stringify(
    sortJson(pathsWithoutApprovedAdditions)
  );
  const actualHash = createHash("sha256")
    .update(canonicalPaths)
    .digest("hex");

  assert.equal(actualHash, preZodPathsCanonicalSha256);
});
