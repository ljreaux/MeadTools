import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baselineCanonicalSha256 =
  "49844af6db83344c1ec241652d1251f4c3e361b01cb7caff56e7d9de030a06ce";
const preZodPathsCanonicalSha256 =
  "4610d8687942691b4d6a411907359deca3fb67c00a6f34dd7acc8ad3ee38076c";

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
  const documentUrl = new URL("../../../public/openapi.json", import.meta.url);
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

test("Zod migration preserves the pre-migration endpoint documentation", async () => {
  const documentUrl = new URL("../../../public/openapi.json", import.meta.url);
  const document = JSON.parse(await readFile(documentUrl, "utf8")) as {
    paths: unknown;
  };
  const canonicalPaths = JSON.stringify(sortJson(document.paths));
  const actualHash = createHash("sha256")
    .update(canonicalPaths)
    .digest("hex");

  assert.equal(actualHash, preZodPathsCanonicalSha256);
});
