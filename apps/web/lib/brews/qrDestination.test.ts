import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { resolveBrewQrDestination } from "./qrDestination";

test("resolver selects only the public recipe ID and rechecks visibility on every scan", async () => {
  let record: { public: boolean; recipePrivate: boolean; recipeId: number | null } | null = {
    public: true, recipePrivate: false, recipeId: 12,
  };
  let calls = 0;
  const database = { brews: { findFirst: async (args: unknown) => {
    calls++;
    assert.deepEqual(args, {
      where: { id: "11111111-1111-4111-8111-111111111111", public: true, recipes: { private: false } },
      select: { recipe_id: true },
    });
    return record?.public && !record.recipePrivate && record.recipeId !== null
      ? { recipe_id: record.recipeId } : null;
  } } } as unknown as Pick<PrismaClient, "brews">;
  assert.equal(await resolveBrewQrDestination(database, "11111111-1111-4111-8111-111111111111", "en"), "/recipes/12/brews/11111111-1111-4111-8111-111111111111");
  record.public = false;
  assert.equal(await resolveBrewQrDestination(database, "11111111-1111-4111-8111-111111111111", "en"), "/account/brews/11111111-1111-4111-8111-111111111111");
  record.public = true;
  record.recipePrivate = true;
  assert.equal(await resolveBrewQrDestination(database, "11111111-1111-4111-8111-111111111111", "en"), "/account/brews/11111111-1111-4111-8111-111111111111");
  record.recipePrivate = false;
  record.recipeId = null;
  assert.equal(await resolveBrewQrDestination(database, "11111111-1111-4111-8111-111111111111", "en"), "/account/brews/11111111-1111-4111-8111-111111111111");
  record = null;
  assert.equal(await resolveBrewQrDestination(database, "11111111-1111-4111-8111-111111111111", "en"), "/account/brews/11111111-1111-4111-8111-111111111111");
  assert.equal(calls, 5);
});
