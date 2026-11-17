import assert from "node:assert/strict";
import test from "node:test";

import { createCatalogStore } from "../src/catalogs/catalog-store";
import {
  CatalogUnavailableError,
  combinedCatalogStatus,
  resolveCatalog
} from "../src/catalogs/resolve-catalog";
import { createMemoryFileSystem } from "./support/outbox-fakes";

const yeasts = [
  { id: 1, brand: "Lalvin" as const, name: "71B", nitrogen_requirement: "Low" as const, tolerance: "14", low_temp: "59", high_temp: "86" }
];
const now = () => new Date("2026-11-15T12:00:00.000Z");

test("an online fetch is saved atomically and returned as fresh", async () => {
  const { fileSystem, files, log } = createMemoryFileSystem();
  const store = createCatalogStore(fileSystem);

  const result = await resolveCatalog({ name: "yeasts", online: true, fetchRemote: async () => yeasts, store, now });

  assert.deepEqual(result, { fetchedAt: "2026-11-15T12:00:00.000Z", data: yeasts, source: "network" });
  assert.deepEqual(log, ["write v1/yeasts.json.tmp", "move v1/yeasts.json.tmp -> v1/yeasts.json"]);
  assert.deepEqual([...files.keys()], ["v1/yeasts.json"]);
  assert.deepEqual(await store.read("yeasts"), { fetchedAt: "2026-11-15T12:00:00.000Z", data: yeasts });
});

test("offline reads the saved copy without calling the server", async () => {
  const { fileSystem } = createMemoryFileSystem();
  const store = createCatalogStore(fileSystem);
  await store.write("yeasts", { fetchedAt: "2026-11-01T08:00:00.000Z", data: yeasts });
  let calls = 0;

  const result = await resolveCatalog({
    name: "yeasts",
    online: false,
    fetchRemote: async () => {
      calls += 1;
      return yeasts;
    },
    store
  });

  assert.equal(calls, 0);
  assert.deepEqual(result, { fetchedAt: "2026-11-01T08:00:00.000Z", data: yeasts, source: "cache" });
});

test("a failed fetch falls back to the saved copy, which stays unchanged", async () => {
  const { fileSystem } = createMemoryFileSystem();
  const store = createCatalogStore(fileSystem);
  await store.write("yeasts", { fetchedAt: "2026-11-01T08:00:00.000Z", data: yeasts });

  const result = await resolveCatalog({
    name: "yeasts",
    online: true,
    fetchRemote: async () => {
      throw new Error("503");
    },
    store
  });

  assert.equal(result.source, "cache");
  assert.equal(result.fetchedAt, "2026-11-01T08:00:00.000Z");
});

test("with nothing saved and no network the catalog is unavailable", async () => {
  const store = createCatalogStore(createMemoryFileSystem().fileSystem);
  const fetchError = new Error("Network request failed");

  await assert.rejects(resolveCatalog({ name: "ingredients", online: false, fetchRemote: async () => [], store }), (error) =>
    error instanceof CatalogUnavailableError && error.catalog === "ingredients");
  await assert.rejects(
    resolveCatalog({ name: "ingredients", online: true, fetchRemote: async () => Promise.reject(fetchError), store }),
    (error) => error instanceof CatalogUnavailableError && error.cause === fetchError
  );
});

test("corrupt, outdated or contract-breaking copies read as missing", async () => {
  const { fileSystem, files } = createMemoryFileSystem();
  const store = createCatalogStore(fileSystem);
  const cases = [
    "{not json",
    JSON.stringify({ version: 0, fetchedAt: "2026-11-01T08:00:00.000Z", data: yeasts }),
    JSON.stringify({ version: 1, fetchedAt: "yesterday", data: yeasts }),
    JSON.stringify({ version: 1, fetchedAt: "2026-11-01T08:00:00.000Z", data: [{ id: "x" }] })
  ];
  for (const contents of cases) {
    files.set("v1/yeasts.json", contents);
    assert.equal(await store.read("yeasts"), null, contents);
  }
});

test("a failed save still returns the fetched list", async () => {
  const { fileSystem } = createMemoryFileSystem();
  const store = createCatalogStore({
    ...fileSystem,
    write: async () => {
      throw new Error("disk full");
    }
  });

  const result = await resolveCatalog({ name: "yeasts", online: true, fetchRemote: async () => yeasts, store, now });
  assert.equal(result.source, "network");
  assert.equal(await store.read("yeasts"), null);
});

test("the Tools status is ready only when every catalog is available", () => {
  const ready = (fetchedAt: string) => ({ data: { fetchedAt }, isPending: false });
  assert.deepEqual(
    combinedCatalogStatus([ready("2026-11-10T00:00:00.000Z"), ready("2026-11-01T00:00:00.000Z"), ready("2026-11-15T00:00:00.000Z")]),
    { kind: "ready", updatedAt: "2026-11-01T00:00:00.000Z" }
  );
  assert.deepEqual(combinedCatalogStatus([ready("2026-11-10T00:00:00.000Z"), { isPending: true }]), { kind: "loading" });
  assert.deepEqual(
    combinedCatalogStatus([ready("2026-11-10T00:00:00.000Z"), { error: new Error("x"), isPending: false }]),
    { kind: "missing" }
  );
});
