import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import "./openapi-type-scan.mjs";
import { ZodSchemaConverter } from "next-openapi-gen/dist/lib/zod-converter.js";

test("the real converter scans empty type mappings once while resolving different schemas", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "meadtools-openapi-scan-"));
  try {
    await writeFile(path.join(directory, "schema.ts"), `
      import { z } from "zod";
      export const firstSchema = z.string();
      export const secondSchema = z.number();
    `);
    const converter = new ZodSchemaConverter(directory, directory);
    let scans = 0;
    const scanFile = converter.scanFileForTypeMappings.bind(converter);
    converter.scanFileForTypeMappings = (...args) => { scans++; return scanFile(...args); };
    assert.deepEqual(converter.convertZodSchemaToOpenApi("firstSchema"), { type: "string" });
    assert.deepEqual(converter.convertZodSchemaToOpenApi("secondSchema"), { type: "number" });
    assert.deepEqual(converter.typeToSchemaMapping, {});
    assert.equal(scans, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
