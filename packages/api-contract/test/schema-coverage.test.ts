import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const sourceDirectory = new URL("../src/", import.meta.url);

test("every exported API contract type has a correspondingly named schema", async () => {
  const contracts = await readFile(
    new URL("contracts.ts", sourceDirectory),
    "utf8"
  );
  const contractNames = Array.from(
    contracts.matchAll(/^export type (\w+)/gm),
    (match) => match[1]
  );
  const zodDirectory = new URL("zod/", sourceDirectory);
  const sourceFiles = (await readdir(zodDirectory)).filter((file) =>
    file.endsWith(".ts")
  );
  const sources = await Promise.all(
    sourceFiles.map((file) =>
      readFile(new URL(file, zodDirectory), "utf8")
    )
  );
  const schemaNames = new Set(
    Array.from(
      sources.join("\n").matchAll(/export const (\w+Schema)\b/g),
      (match) => match[1]
    )
  );
  const missingSchemas = contractNames.filter((contractName) => {
    const schemaName = `${contractName[0].toLowerCase()}${contractName.slice(1)}Schema`;
    return !schemaNames.has(schemaName);
  });

  assert.equal(contractNames.length, schemaNames.size);
  assert.deepEqual(missingSchemas, []);
});
