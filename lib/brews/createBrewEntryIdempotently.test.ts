import assert from "node:assert/strict";
import test from "node:test";

import {
  BrewEntryIdConflictError,
  createBrewEntryIdempotently,
  type BrewEntryIdentity
} from "@/lib/brews/createBrewEntryIdempotently";

test("retries with the same client entry ID resolve to one stored entry", async () => {
  const entries = new Map<string, BrewEntryIdentity>();
  let createCount = 0;
  const create = async (clientEntryId?: string) => {
    const id = clientEntryId ?? "server-generated";
    const existing = entries.get(id);
    if (existing) return existing;

    createCount += 1;
    const entry = { id, brew_id: "brew-1", user_id: 7 };
    entries.set(id, entry);
    return entry;
  };

  const first = await createBrewEntryIdempotently({
    brewId: "brew-1",
    userId: 7,
    clientEntryId: "client-entry-id",
    create
  });
  const retry = await createBrewEntryIdempotently({
    brewId: "brew-1",
    userId: 7,
    clientEntryId: "client-entry-id",
    create
  });

  assert.equal(createCount, 1);
  assert.equal(entries.size, 1);
  assert.equal(first, retry);
});

test("a client entry ID cannot be reused for another brew or owner", async () => {
  const existing = {
    id: "client-entry-id",
    brew_id: "another-brew",
    user_id: 99
  };

  await assert.rejects(
    createBrewEntryIdempotently({
      brewId: "brew-1",
      userId: 7,
      clientEntryId: "client-entry-id",
      create: async () => existing
    }),
    BrewEntryIdConflictError
  );
});

test("omitting a client entry ID preserves server-generated creation", async () => {
  let receivedClientId: string | undefined = "not-called";

  const entry = await createBrewEntryIdempotently({
    brewId: "brew-1",
    userId: 7,
    create: async (clientEntryId) => {
      receivedClientId = clientEntryId;
      return {
        id: "server-generated-id",
        brew_id: "brew-1",
        user_id: 7
      };
    }
  });

  assert.equal(receivedClientId, undefined);
  assert.equal(entry.id, "server-generated-id");
});
