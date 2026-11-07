import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { after, beforeEach, test } from "node:test";

// This fixture never reads application env files or touches the development DB.
const database = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(["localhost", "127.0.0.1"].includes(database.hostname));
assert.equal(database.pathname, "/meadtools_inventory_transactions_test");
process.env.NODE_ENV = "test";
process.env.PREMIUM_ACCESS_ENABLED = "true";
const { default: prisma } = await import("../lib/prisma.ts");
const { createInventoryService } = await import("../lib/db/inventory.ts");
const service = createInventoryService(prisma);
const { NextRequest } = await import("next/server");
// Authentication is already covered separately. Stub only that boundary; keep
// the real request parsing, route handlers, entitlement checks and database writes.
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/userAccessFunctions") return {
    url: "data:text/javascript,export async function verifyUser(req) { return Number(req.headers.get('x-inventory-fixture-user')); }",
    shortCircuit: true,
  };
  return nextResolve(specifier, context);
} });
const batchRoute=await import("../app/api/brews/[brew_id]/entries/batch/route.ts");
const createRoute = await import("../app/api/brews/[brew_id]/entries/route.ts");
const entryRoute = await import("../app/api/brews/[brew_id]/entries/[entry_id]/route.ts");
const equipmentRoute = await import("../app/api/account/equipment/route.ts");
const equipmentItemRoute = await import("../app/api/account/equipment/[equipment_id]/route.ts");
const inventoryTransferRoute=await import("../app/api/account/inventory/transfer/route.ts");
const inventoryRoute = await import("../app/api/account/inventory/route.ts");
const inventoryItemRoute = await import("../app/api/account/inventory/[stock_id]/route.ts");
const organizationRoute = await import("../app/api/account/inventory/organization/route.ts");
const storageRoute = await import("../app/api/account/inventory/storage/[stock_id]/route.ts");
const finishedMeadsRoute = await import("../app/api/account/inventory/meads/route.ts");
const finishedMeadRoute = await import("../app/api/account/inventory/meads/[mead_id]/route.ts");
const brewMetadataRoute = await import("../app/api/brews/[brew_id]/route.ts");
const brewInventoryRoute = await import("../app/api/brews/[brew_id]/inventory/route.ts");
const bottlingChangeRoute = await import("../app/api/account/inventory/bottlings/[bottling_id]/route.ts");
hooks.deregister();
const contract = await import("@meadtools/api-contract/brews");
const equipmentContract = await import("@meadtools/api-contract/equipment");
const { patchBrewMetadata, deleteBrewForApp } = await import("../lib/db/brews.ts");
const { seedInventory } = await import("../prisma/seed-inventory.ts");
const { seedEquipment } = await import("../prisma/seed-equipment.ts");
const hydrometerBrews = await import("../lib/db/iSpindel.ts");

async function route(method, f, input, entryId) {
  const request = new NextRequest(`http://localhost/api/brews/${f.brewId}/entries${entryId ? `/${entryId}` : ""}`, {
    method,
    headers: { "x-inventory-fixture-user": String(f.userId),
      ...(input === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const response = await (method === "POST" ? createRoute.POST : entryRoute[method])(request, {
    params: Promise.resolve({ brew_id: f.brewId, entry_id: entryId }),
  });
  return { status: response.status, body: await response.json() };
}
const selection = (f, deducted = null) => ({ mode: "deduct", stock_id: f.stockId,
  operation_id: randomUUID(), expected: deducted === null ? null : { stock_id: f.stockId, deducted: kg(deducted) } });
const addition = (amount, inventory, entryId = randomUUID(), unit = "kg") => ({
  type: "ADDITION", client_entry_id: entryId, data: { kind: "INGREDIENT", name: "Honey", amount, unit }, inventory,
});

async function equipmentRequest(method, userId, input, id) {
  const response = await (method === "PATCH" ? equipmentItemRoute.PATCH : equipmentRoute[method])(
    new NextRequest(`http://localhost/api/account/equipment${id ? `/${id}` : ""}`, {
      method, headers: { "x-inventory-fixture-user": String(userId), "Content-Type": "application/json" },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    }), { params: Promise.resolve({ equipment_id: id }) });
  return { status: response.status, body: await response.json() };
}
const vesselInput = () => ({ operation_id: randomUUID(), equipment: {
  name: "Test carboy", type: "vessel", capacity: { value: 5, unit: "L" }, notes: null,
} });
const assignInput = (brewId, expected = null, reassign = false) => ({
  action: "assign", operation_id: randomUUID(), brew_id: brewId, expected_brew_id: expected, reassign,
});

beforeEach(async () => {
  process.env.PREMIUM_ACCESS_ENABLED = "true";
  await prisma.$executeRawUnsafe("TRUNCATE users CASCADE");
});
after(() => prisma.$disconnect());
const kg = (value) => ({ value, unit: "kg" });
const code = (expected) => (error) => error?.code === expected;
async function owner(premium = true) {
  const user = await prisma.users.create({ data: { email: `${randomUUID()}@fixture.invalid` } });
  if (premium) await prisma.premium_memberships.create({ data: {
    user_id: user.id, source: "manual", paid_through: new Date("2100-01-01T00:00:00Z"),
  } });
  return user.id;
}
const stock = (userId, value = 5, operationKey = randomUUID()) => service.createStock(userId, operationKey, {
  name: "Honey", category: "honey", quantity: kg(value),
});
const balance = async (stockId) => (await prisma.inventory_stock.findUniqueOrThrow({ where: { id: stockId } })).quantity.toNumber();
async function fixture() {
  const userId = await owner();
  const item = await stock(userId);
  const brew = await prisma.brews.create({ data: { user_id: userId } });
  return { userId, stockId: item.stockId, brewId: brew.id };
}
function usage(f, overrides = {}) {
  const quantity = overrides.quantity === undefined ? kg(1) : overrides.quantity;
  return {
    brewId: f.brewId, entryId: randomUUID(), kind: "create", stockId: f.stockId,
    quantity, expected: null, entryMutation: { amount: quantity?.value ?? null, unit: quantity?.unit ?? null },
    ...overrides,
  };
}
const writer = (userId, input, extra) => async (tx) => {
  if (input.kind === "remove") {
    await tx.brew_entries.delete({ where: { id: input.entryId } });
  } else if (input.kind === "create") {
    await tx.brew_entries.create({ data: {
      id: input.entryId, brew_id: input.brewId, user_id: userId, type: "ADDITION",
      data: input.entryMutation,
    } });
  } else {
    await tx.brew_entries.update({ where: { id: input.entryId }, data: { data: input.entryMutation } });
  }
  if (extra) await extra(tx);
};
const save = (f, input, key = randomUUID(), extra) =>
  service.mutateLinkedUsage(f.userId, key, input, writer(f.userId, input, extra));

test("stock creation and receipts replay once; operation keys reject different requests", async () => {
  const userId = await owner();
  const key = randomUUID();
  const first = await stock(userId, 5, key);
  assert.deepEqual(await stock(userId, 5, key), first);
  await assert.rejects(stock(userId, 6, key), code("OPERATION_CONFLICT"));
  const receiptKey = randomUUID();
  const change = { stockId: first.stockId, kind: "receipt", quantity: kg(1) };
  const results = await Promise.all(Array.from({ length: 5 }, () => service.changeStock(userId, receiptKey, change)));
  assert.ok(results.every((result) => result.balance.value === 6));
  assert.equal(await balance(first.stockId), 6);
  assert.equal(await prisma.inventory_stock.count(), 1);
  assert.equal(await prisma.inventory_adjustments.count(), 2);
  const empty = await stock(userId, 0);
  assert.equal(await balance(empty.stockId), 0);
  assert.equal(await prisma.inventory_adjustments.count({ where: { stock_id: empty.stockId } }), 0);
});

test("concurrent manual use preserves balances; stale absolute correction is rejected", async () => {
  const f = await fixture();
  await Promise.all(Array.from({ length: 10 }, () => service.changeStock(f.userId, randomUUID(), {
    stockId: f.stockId, kind: "manual_use", quantity: kg(0.1),
  })));
  assert.equal(await balance(f.stockId), 4);
  await assert.rejects(service.changeStock(f.userId, randomUUID(), {
    stockId: f.stockId, kind: "correction", quantity: kg(6), expectedBalance: kg(5),
  }), code("STALE_STOCK"));
  await service.changeStock(f.userId, randomUUID(), {
    stockId: f.stockId, kind: "correction", quantity: kg(6), expectedBalance: kg(4),
  });
  assert.equal(await balance(f.stockId), 6);
});

test("linked usage creates, retries, corrects, removes once, and retains a tombstone", async () => {
  const f = await fixture();
  const original = usage(f, { quantity: { value: 1000, unit: "g" }, entryMutation: { amount: 1000, unit: "g" } });
  const key = randomUUID();
  const responses = await Promise.all([save(f, original, key), save(f, original, key)]);
  assert.deepEqual(responses[0], responses[1]);
  assert.equal(await balance(f.stockId), 4);
  assert.equal(await prisma.brew_entries.count(), 1);
  const edited = usage(f, { entryId: original.entryId, kind: "edit", quantity: kg(1.5),
    expected: { stockId: f.stockId, deducted: kg(1) }, entryMutation: { amount: 1.5, unit: "kg" } });
  await save(f, edited);
  assert.equal(await balance(f.stockId), 3.5);
  const removal = usage(f, { entryId: original.entryId, kind: "remove", quantity: null,
    expected: { stockId: f.stockId, deducted: kg(1.5) }, entryMutation: { remove: true } });
  const removeKey = randomUUID();
  await save(f, removal, removeKey);
  await save(f, removal, removeKey);
  assert.equal(await balance(f.stockId), 5);
  assert.equal(await prisma.brew_entries.count(), 0);
  assert.equal(await prisma.inventory_adjustments.count(), 4);
  assert.ok((await prisma.inventory_consumptions.findFirstOrThrow()).reversed_at);
  await assert.rejects(save(f, original), code("USAGE_REMOVED"));
  assert.equal(await balance(f.stockId), 5);
});

test("competing deductions cannot overdraw or leave a partially saved brew use", async () => {
  const f = await fixture();
  const inputs = [usage(f, { quantity: kg(4), entryMutation: { amount: 4, unit: "kg" } }),
    usage(f, { quantity: kg(4), entryMutation: { amount: 4, unit: "kg" } })];
  const results = await Promise.allSettled(inputs.map((input) => save(f, input)));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.code, "INSUFFICIENT_STOCK");
  assert.equal(await balance(f.stockId), 1);
  assert.equal(await prisma.brew_entries.count(), 1);
  assert.equal(await prisma.inventory_consumptions.count(), 1);
  assert.equal(await prisma.inventory_operations.count(), 2);
});

test("a failed callback rolls back its entry and operation; the same request can be retried", async () => {
  const f = await fixture();
  const input = usage(f);
  const key = randomUUID();
  await assert.rejects(save(f, input, key, async () => { throw new Error("fixture failure"); }), /fixture failure/);
  assert.equal(await balance(f.stockId), 5);
  assert.equal(await prisma.brew_entries.count(), 0);
  assert.equal(await prisma.inventory_operations.count(), 1);
  await save(f, input, key);
  assert.equal(await balance(f.stockId), 4);
});

test("failure while inserting the audit row rolls back entry, stock, link, and retry record", async () => {
  const f = await fixture();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION inventory_fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.kind = 'brew_use' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER inventory_fixture_failure BEFORE INSERT ON inventory_adjustments
    FOR EACH ROW EXECUTE FUNCTION inventory_fixture_failure()`);
  try {
    await assert.rejects(save(f, usage(f)), /fixture audit failure/);
    assert.equal(await balance(f.stockId), 5);
    assert.equal(await prisma.brew_entries.count(), 0);
    assert.equal(await prisma.inventory_consumptions.count(), 0);
    assert.equal(await prisma.inventory_operations.count(), 1);
    assert.equal(await prisma.inventory_adjustments.count(), 1);
  } finally {
    await prisma.$executeRawUnsafe("DROP TRIGGER inventory_fixture_failure ON inventory_adjustments");
    await prisma.$executeRawUnsafe("DROP FUNCTION inventory_fixture_failure()");
  }
});

test("switching matched stock reverses the old deduction and saves the new one atomically", async () => {
  const f = await fixture();
  const second = await stock(f.userId);
  const original = usage(f);
  await save(f, original);
  const change = usage(f, { entryId: original.entryId, kind: "edit", stockId: second.stockId,
    quantity: kg(2), expected: { stockId: f.stockId, deducted: kg(1) }, entryMutation: { amount: 2, unit: "kg" } });
  const key = randomUUID();
  await save(f, change, key);
  await save(f, change, key);
  assert.equal(await balance(f.stockId), 5);
  assert.equal(await balance(second.stockId), 3);
  const link = await prisma.inventory_consumptions.findFirstOrThrow();
  assert.equal(link.stock_id, second.stockId);
  assert.equal(link.deducted.toNumber(), 2);
  assert.equal(await prisma.inventory_adjustments.count({ where: { consumption_id: link.id } }), 3);
});

test("a shortage when switching stock leaves the original deduction and entry intact", async () => {
  const f = await fixture();
  const empty = await stock(f.userId, 0);
  const original = usage(f);
  await save(f, original);
  const change = usage(f, { entryId: original.entryId, kind: "edit", stockId: empty.stockId,
    expected: { stockId: f.stockId, deducted: kg(1) } });
  await assert.rejects(save(f, change), code("INSUFFICIENT_STOCK"));
  assert.equal(await balance(f.stockId), 4);
  assert.equal(await balance(empty.stockId), 0);
  assert.equal((await prisma.inventory_consumptions.findFirstOrThrow()).stock_id, f.stockId);
  assert.equal(await prisma.inventory_adjustments.count(), 2);
});

test("archived stock rejects new usage but an erroneous linked use can still be reversed", async () => {
  const f = await fixture();
  const original = usage(f);
  await save(f, original);
  await prisma.inventory_stock.update({ where: { id: f.stockId }, data: { archived_at: new Date() } });
  await assert.rejects(save(f, usage(f)), code("STOCK_ARCHIVED"));
  await assert.rejects(service.changeStock(f.userId, randomUUID(), {
    stockId: f.stockId, kind: "receipt", quantity: kg(1),
  }), code("STOCK_ARCHIVED"));
  await save(f, usage(f, { entryId: original.entryId, kind: "remove", quantity: null,
    expected: { stockId: f.stockId, deducted: kg(1) }, entryMutation: { remove: true } }));
  assert.equal(await balance(f.stockId), 5);
});

test("retry fingerprints include entry metadata and ignore JSON object key ordering", async () => {
  const f = await fixture();
  const original = usage(f, { entryMutation: { amount: 1, unit: "kg", note: "first" } });
  const key = randomUUID();
  await save(f, original, key);
  await service.mutateLinkedUsage(f.userId, key, { ...original,
    entryMutation: { note: "first", unit: "kg", amount: 1 } }, async () => {
    throw new Error("replay must not execute the writer");
  });
  await assert.rejects(save(f, { ...original, entryMutation: { ...original.entryMutation, note: "different" } }, key),
    code("OPERATION_CONFLICT"));
  assert.equal(await balance(f.stockId), 4);
});

test("concurrent edits from the same prior deduction reject the stale edit", async () => {
  const f = await fixture();
  const original = usage(f);
  await save(f, original);
  const inputs = [2, 3].map((amount) => usage(f, { entryId: original.entryId, kind: "edit",
    quantity: kg(amount), expected: { stockId: f.stockId, deducted: kg(1) }, entryMutation: { amount, unit: "kg" } }));
  const results = await Promise.allSettled(inputs.map((input) => save(f, input)));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.code, "STALE_USAGE");
  const entry = await prisma.brew_entries.findUniqueOrThrow({ where: { id: original.entryId } });
  assert.equal(await balance(f.stockId), 5 - entry.data.amount);
});

test("invalid conversions and persisted entry mismatches roll back without consumption", async () => {
  const f = await fixture();
  await assert.rejects(save(f, usage(f, { quantity: { value: 1, unit: "L" },
    entryMutation: { amount: 1, unit: "L" } })), code("INCOMPATIBLE_UNITS"));
  await assert.rejects(save(f, usage(f, { entryMutation: { amount: 2, unit: "kg" } })), code("ENTRY_MISMATCH"));
  await assert.rejects(service.changeStock(f.userId, randomUUID(), {
    stockId: f.stockId, kind: "receipt", quantity: kg(-1),
  }));
  assert.equal(await balance(f.stockId), 5);
  assert.equal(await prisma.brew_entries.count(), 0);
  assert.equal(await prisma.inventory_consumptions.count(), 0);
});

test("foreign stock, brew and entry identities cannot be consumed or corrected", async () => {
  const f = await fixture();
  const foreign = await fixture();
  await assert.rejects(save(f, usage(f, { stockId: foreign.stockId })), code("NOT_FOUND"));
  await assert.rejects(save(f, usage(f, { brewId: foreign.brewId })), code("NOT_FOUND"));
  const original = usage(foreign);
  await save(foreign, original);
  await assert.rejects(save(f, usage(f, { entryId: original.entryId, kind: "edit",
    expected: { stockId: f.stockId, deducted: kg(1) } })), code("ENTRY_MISMATCH"));
  assert.equal(await balance(f.stockId), 5);
  assert.equal(await balance(foreign.stockId), 4);
});

test("free, expired, inactive, payment-restricted, and disabled-premium accounts cannot write", async () => {
  const userId = await owner(false);
  await assert.rejects(stock(userId), code("PREMIUM_REQUIRED"));
  await prisma.premium_memberships.create({ data: { user_id: userId, source: "manual", paid_through: new Date("2000-01-01") } });
  await assert.rejects(stock(userId), code("PREMIUM_REQUIRED"));
  await prisma.premium_memberships.updateMany({ where: { user_id: userId }, data: { paid_through: new Date("2100-01-01") } });
  await prisma.users.update({ where: { id: userId }, data: { active: false } });
  await assert.rejects(stock(userId), code("PREMIUM_REQUIRED"));
  await prisma.users.update({ where: { id: userId }, data: { active: true } });
  await prisma.credit_accounts.create({ data: { user_id: userId, payment_restricted_at: new Date() } });
  await assert.rejects(stock(userId), code("PREMIUM_REQUIRED"));
  await prisma.credit_accounts.updateMany({ data: { payment_restricted_at: null } });
  process.env.PREMIUM_ACCESS_ENABLED = "false";
  await assert.rejects(stock(userId), code("PREMIUM_REQUIRED"));
  assert.equal(await prisma.inventory_operations.count(), 0);
});

test("historical brew deletion preserves deductions; replay cannot recreate deleted entries", async () => {
  const f = await fixture();
  const original = usage(f);
  const key = randomUUID();
  const result = await save(f, original, key);
  await prisma.brews.delete({ where: { id: f.brewId } });
  assert.equal(await balance(f.stockId), 4);
  assert.equal(await prisma.inventory_consumptions.count(), 1);
  assert.deepEqual(await save(f, original, key), result);
  assert.equal(await prisma.brew_entries.count(), 0);
  assert.equal(await prisma.brews.count(), 0);
});

test("brew entry API deducts, corrects and reverses through the real entry writers", async () => {
  const f = await fixture();
  const input = addition(1, selection(f));
  const created = await route("POST", f, input);
  assert.equal(created.status, 201);
  contract.createBrewEntryResponseSchema.parse(created.body);
  assert.equal(created.body.brew.id, f.brewId);
  assert.equal(JSON.stringify(created.body.brew).includes(f.stockId), false);
  assert.equal(created.body.inventory.status, "deducted");
  assert.equal(await balance(f.stockId), 4);
  assert.equal((await route("POST", f, input)).status, 201);
  assert.equal(await balance(f.stockId), 4);
  const edit = { data: { ...input.data, amount: 1.5 }, inventory: selection(f, 1) };
  const edited = await route("PATCH", f, edit, input.client_entry_id);
  assert.equal(edited.status, 200);
  contract.updateBrewEntryResponseSchema.parse(edited.body);
  assert.equal(edited.body.entry.data.amount, 1.5);
  assert.equal(await balance(f.stockId), 3.5);
  const removal = { inventory: selection(f, 1.5) };
  const removed = await route("DELETE", f, removal, input.client_entry_id);
  assert.equal(removed.status, 200);
  contract.deleteBrewEntrySuccessResponseSchema.parse(removed.body);
  assert.equal((await route("DELETE", f, removal, input.client_entry_id)).status, 200);
  assert.equal(await balance(f.stockId), 5);
  assert.equal(await prisma.brew_entries.count(), 0);
});

test("API shortages, incompatible units and missing inventory confirmation do not partially save", async () => {
  const f = await fixture();
  const shortage = await route("POST", f, addition(6, selection(f)));
  assert.equal(shortage.status, 409);
  assert.equal(shortage.body.code, "INSUFFICIENT_STOCK");
  assert.equal(shortage.body.shortage, 1);
  contract.brewInventoryErrorResponseSchema.parse(shortage.body);
  assert.equal((await route("POST", f, addition(1, selection(f), randomUUID(), "L"))).status, 400);
  assert.equal((await route("POST", f, addition(1, selection(f), randomUUID(), "bags"))).status, 400);
  assert.equal(await prisma.brew_entries.count(), 0);
  const input = addition(1, selection(f));
  await route("POST", f, input);
  const noSelection = await route("PATCH", f, { data: { ...input.data, amount: 2 } }, input.client_entry_id);
  assert.equal(noSelection.status, 409);
  assert.equal(noSelection.body.code, "SELECTION_REQUIRED");
  assert.equal((await route("DELETE", f, undefined, input.client_entry_id)).status, 409);
  assert.equal((await route("PATCH", f, { note: "Metadata only" }, input.client_entry_id)).status, 200);
  assert.equal(await balance(f.stockId), 4);
});

test("free and expired API logging continues without changing retained balances", async () => {
  const f = await fixture();
  const input = addition(1, selection(f));
  await route("POST", f, input);
  await prisma.premium_memberships.updateMany({ where: { user_id: f.userId }, data: { paid_through: new Date("2000-01-01") } });
  const denied = await route("POST", f, addition(1, selection(f)));
  assert.equal(denied.status, 403);
  const untracked = await route("POST", f, addition(1, { mode: "untracked" }));
  assert.equal(untracked.status, 201);
  assert.equal(untracked.body.inventory.status, "premium_unavailable");
  const edited = await route("PATCH", f, { data: { ...input.data, amount: 2 } }, input.client_entry_id);
  assert.equal(edited.status, 200);
  assert.equal(edited.body.inventory.status, "reconciliation_required");
  assert.equal((await prisma.inventory_stock.findUniqueOrThrow({ where: { id: f.stockId } })).reconciliation_required, true);
  assert.equal(await balance(f.stockId), 4);
  assert.equal((await route("DELETE", f, undefined, input.client_entry_id)).status, 200);
  assert.equal(await balance(f.stockId), 4);
  // A legacy retry cannot resurrect an entry whose retained consumption has no entry.
  assert.equal((await route("POST", f, { ...input, inventory: { mode: "untracked" } })).status, 409);
  await prisma.premium_memberships.updateMany({ where: { user_id: f.userId }, data: { paid_through: new Date("2100-01-01") } });
  const afterRenewal = await route("POST", f, addition(1, selection(f)));
  assert.equal(afterRenewal.status, 409);
  assert.equal(afterRenewal.body.code, "RECONCILIATION_REQUIRED");
  assert.equal(await balance(f.stockId), 4);
});

test("existing additive/recipe unit aliases deduct the same quantities through the API", async () => {
  const f = await fixture();
  const pounds = await route("POST", f, addition(1, selection(f), randomUUID(), "lbs"));
  assert.equal(pounds.status, 201);
  assert.equal(await balance(f.stockId), 4.546408);
  const volumeStock = await service.createStock(f.userId, randomUUID(), {
    name: "Liquid additive", category: "additive", quantity: { value: 5, unit: "L" },
  });
  const volume = await route("POST", f, addition(1000, selection({ ...f, stockId: volumeStock.stockId }), randomUUID(), "ml"));
  assert.equal(volume.status, 201);
  assert.equal(await balance(volumeStock.stockId), 4);
});

test("legacy untracked notes, volume and gravity still update derived brew fields", async () => {
  const f = await fixture();
  const userId = await owner(false);
  const brew = await prisma.brews.create({ data: { user_id: userId } });
  const free = { userId, brewId: brew.id };
  const entryId = randomUUID();
  assert.equal((await route("POST", free, { type: "NOTE", client_entry_id: entryId, note: "Free note" })).status, 201);
  assert.equal((await route("PATCH", free, { note: "Corrected" }, entryId)).status, 200);
  assert.equal((await route("DELETE", free, undefined, entryId)).status, 200);
  assert.equal((await route("POST", free, { type: "VOLUME", data: { liters: 4 } })).status, 201);
  assert.equal((await route("POST", free, { type: "GRAVITY", gravity: 1.05 })).status, 201);
  const saved = await prisma.brews.findUniqueOrThrow({ where: { id: free.brewId } });
  assert.equal(saved.current_volume_liters, 4);
  assert.ok(Math.abs(saved.latest_gravity - 1.05) < 0.00001);
  assert.equal((await route("POST", f, { type: "STAGE_CHANGE", stage_to: "PRIMARY" })).status, 201);
  assert.equal(await balance(f.stockId), 5);
});

test("direct API requests enforce ownership, valid selections and stable IDs", async () => {
  const f = await fixture();
  const foreign = await fixture();
  assert.equal((await route("POST", f, addition(1, selection(foreign)))).status, 404);
  assert.equal((await route("POST", { ...f, brewId: foreign.brewId }, addition(1, selection(f)))).status, 404);
  assert.equal((await route("POST", f, { ...addition(1, selection(f)), client_entry_id: undefined })).status, 400);
  assert.equal((await route("POST", f, addition(1, { ...selection(f), stock_id: "invalid" }))).status, 400);
  assert.equal((await route("POST", f, { type: "STAGE_CHANGE", stage_to: "PRIMARY", inventory: selection(f) })).status, 400);
  assert.equal(await balance(f.stockId), 5);
  assert.equal(await prisma.inventory_consumptions.count(), 0);
});

test("equipment seed creates recipe-linked examples and a six-bucket pool for only the regular user", async () => {
  const userId = await owner();
  const otherId = await owner();
  const { readFile } = await import("node:fs/promises");
  const rows = JSON.parse(await readFile(new URL("../prisma/seed-data/recipes_rows.json", import.meta.url), "utf8"))
    .filter((row) => ["Key Lime Pie", "Mead Wiki Simple Trad Metric"].includes(row.name));
  await prisma.recipes.createMany({ data: rows.map((row) => ({ ...row, user_id: userId, dataV2: JSON.parse(row.dataV2) })) });
  const recipe = await prisma.recipes.findFirstOrThrow({ where: { name: "Key Lime Pie" } });
  const existing = await prisma.brews.create({ data: { user_id: userId, recipe_id: recipe.id, name: "Planning Test Brew" } });
  await seedEquipment(prisma, userId);
  assert.equal(await prisma.equipment.count({ where: { user_id: userId } }), 28);
  assert.equal(await prisma.equipment.count({ where: { user_id: otherId } }), 0);
  assert.equal(await prisma.equipment.count({ where: { current_brew_id: { not: null } } }), 2);
  assert.equal(await prisma.equipment.count({ where: { type: "vessel", current_brew_id: null } }), 11);
  assert.equal(await prisma.equipment_assignment_events.count(), 2);
  assert.equal(await prisma.brews.count(), 2);
  assert.equal(await prisma.equipment.count({ where: { current_brew_id: existing.id } }), 1);
  assert.equal(await prisma.inventory_consumptions.count(), 0);
  const ingredients = recipe.dataV2.ingredients;
  const volumeGal = (secondary) => ingredients.filter((row) => secondary || !row.secondary)
    .reduce((total, row) => {
      assert.equal(row.amounts.volume.unit, "gal");
      return total + Number(row.amounts.volume.value);
    }, 0);
  const equipment = await prisma.equipment.findMany({ where: { user_id: userId } });
  for (const [name, requiredGal] of [
    ["Key Lime Pie primary fermenter", volumeGal(false)],
    ["Key Lime Pie secondary carboy", volumeGal(true)],
    ["Bottling bucket with spigot", volumeGal(true)],
  ]) {
    const vessel = equipment.find((item) => item.name === name);
    assert.equal(vessel.capacity_unit, "gal");
    assert.ok(vessel.capacity.toNumber() > requiredGal, `${name} needs room for the recipe`);
  }
  assert.ok(equipment.filter((item) => item.capacity_unit === "gal").length >
    equipment.filter((item) => item.capacity_unit === "L").length);
  const result = await equipmentRequest("GET", userId);
  assert.equal(result.status, 200);
  equipmentContract.equipmentOverviewResponseSchema.parse(result.body);
});

test("equipment CRUD APIs validate capacities, protect ownership and replay saves", async () => {
  const userId = await owner();
  const otherId = await owner();
  const input = vesselInput();
  const created = await equipmentRequest("POST", userId, input);
  assert.equal(created.status, 201);
  equipmentContract.equipmentMutationResponseSchema.parse(created.body);
  const id = created.body.equipment.id;
  assert.equal((await equipmentRequest("POST", userId, input)).body.equipment.id, id);
  assert.equal(await prisma.equipment.count(), 1);
  const edit = { action: "edit", operation_id: randomUUID(), equipment: { ...input.equipment, name: "Aging carboy" } };
  assert.equal((await equipmentRequest("PATCH", userId, edit, id)).status, 200);
  assert.equal((await equipmentRequest("PATCH", otherId, edit, id)).status, 404);
  assert.equal((await equipmentRequest("GET", otherId)).body.equipment.length, 0);
  for (const capacity of [{ value: -1, unit: "L" }, { value: 1, unit: "kg" }]) {
    assert.equal((await equipmentRequest("POST", userId, { ...vesselInput(), equipment: { ...input.equipment, capacity } })).status, 400);
  }
  const archive = { action: "archive", operation_id: randomUUID() };
  assert.equal((await equipmentRequest("PATCH", userId, archive, id)).status, 200);
  assert.equal((await equipmentRequest("PATCH", userId, archive, id)).status, 200);
  assert.equal((await equipmentRequest("GET", userId)).body.equipment.length, 0);
  assert.ok((await prisma.equipment.findUniqueOrThrow({ where: { id } })).archived_at);
});

test("vessel API requires explicit reassignment and rejects stale, foreign and completed targets", async () => {
  const f = await fixture();
  const foreign = await fixture();
  const second = await prisma.brews.create({ data: { user_id: f.userId } });
  const completed = await prisma.brews.create({ data: { user_id: f.userId, stage: "COMPLETE" } });
  const created = await equipmentRequest("POST", f.userId, vesselInput());
  const id = created.body.equipment.id;
  const assigned = assignInput(f.brewId);
  assert.equal((await equipmentRequest("PATCH", f.userId, assigned, id)).status, 200);
  assert.equal((await equipmentRequest("PATCH", f.userId, assigned, id)).status, 200);
  assert.equal(await prisma.equipment_assignment_events.count(), 1);
  const stale = await equipmentRequest("PATCH", f.userId, assignInput(second.id), id);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, "ASSIGNMENT_CHANGED");
  assert.equal((await equipmentRequest("PATCH", f.userId, assignInput(second.id, f.brewId), id)).status, 409);
  assert.equal((await equipmentRequest("PATCH", f.userId, assignInput(foreign.brewId, f.brewId, true), id)).status, 404);
  assert.equal((await equipmentRequest("PATCH", f.userId, assignInput(completed.id, f.brewId, true), id)).status, 409);
  assert.equal((await equipmentRequest("PATCH", f.userId, { action: "archive", operation_id: randomUUID() }, id)).status, 409);
  assert.equal((await equipmentRequest("PATCH", f.userId, assignInput(second.id, f.brewId, true), id)).status, 200);
  assert.equal((await equipmentRequest("PATCH", f.userId, assignInput(null, second.id), id)).status, 200);
  assert.equal(await prisma.equipment_assignment_events.count(), 3);
});

test("concurrent vessel assignments cannot displace a newly assigned brew", async () => {
  const f = await fixture();
  const second = await prisma.brews.create({ data: { user_id: f.userId } });
  const id = (await equipmentRequest("POST", f.userId, vesselInput())).body.equipment.id;
  const results = await Promise.all([f.brewId, second.id].map((brew) => equipmentRequest("PATCH", f.userId, assignInput(brew), id)));
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal(await prisma.equipment_assignment_events.count(), 1);
});

test("expired premium retains equipment reads and free brew completion/deletion releases occupancy", async () => {
  const f = await fixture();
  const id = (await equipmentRequest("POST", f.userId, vesselInput())).body.equipment.id;
  await equipmentRequest("PATCH", f.userId, assignInput(f.brewId), id);
  await prisma.premium_memberships.updateMany({ where: { user_id: f.userId }, data: { paid_through: new Date("2000-01-01") } });
  const overview = await equipmentRequest("GET", f.userId);
  assert.equal(overview.status, 200);
  assert.equal(overview.body.can_manage, false);
  assert.equal(overview.body.equipment.length, 1);
  assert.equal((await equipmentRequest("POST", f.userId, vesselInput())).status, 403);
  assert.equal((await equipmentRequest("PATCH", f.userId, assignInput(null, f.brewId), id)).status, 403);
  await patchBrewMetadata(f.userId, f.brewId, { stage: "COMPLETE" });
  assert.equal((await prisma.equipment.findUniqueOrThrow({ where: { id } })).current_brew_id, null);
  assert.equal(await prisma.equipment_assignment_events.count(), 2);
  await prisma.premium_memberships.updateMany({ where: { user_id: f.userId }, data: { paid_through: new Date("2100-01-01") } });
  const next = await prisma.brews.create({ data: { user_id: f.userId } });
  await equipmentRequest("PATCH", f.userId, assignInput(next.id), id);
  await deleteBrewForApp(next.id, f.userId);
  assert.equal((await prisma.equipment.findUniqueOrThrow({ where: { id } })).current_brew_id, null);
  assert.equal(await prisma.equipment_assignment_events.count(), 4);
  assert.equal(await balance(f.stockId), 5);
});

test("hydrometer completion and deletion also release assigned vessels", async () => {
  const f = await fixture();
  const id = (await equipmentRequest("POST", f.userId, vesselInput())).body.equipment.id;
  const device = await prisma.devices.create({ data: { user_id: f.userId, brew_id: f.brewId } });
  await equipmentRequest("PATCH", f.userId, assignInput(f.brewId), id);
  await hydrometerBrews.endBrew(device.id, f.brewId, f.userId);
  assert.equal((await prisma.equipment.findUniqueOrThrow({ where: { id } })).current_brew_id, null);
  const second = await prisma.brews.create({ data: { user_id: f.userId } });
  await equipmentRequest("PATCH", f.userId, assignInput(second.id), id);
  await hydrometerBrews.deleteBrew(second.id, f.userId);
  assert.equal((await prisma.equipment.findUniqueOrThrow({ where: { id } })).current_brew_id, null);
  assert.equal(await prisma.equipment_assignment_events.count(), 4);
});

test("a concurrent brew completion cannot leave an occupied completed vessel", async () => {
  const f = await fixture();
  const id = (await equipmentRequest("POST", f.userId, vesselInput())).body.equipment.id;
  const results = await Promise.allSettled([
    equipmentRequest("PATCH", f.userId, assignInput(f.brewId), id),
    patchBrewMetadata(f.userId, f.brewId, { stage: "COMPLETE" }),
  ]);
  assert.ok(results.every((result) => result.status === "fulfilled"));
  const assignment = results[0].value;
  assert.ok([200, 409].includes(assignment.status));
  assert.equal((await prisma.equipment.findUniqueOrThrow({ where: { id } })).current_brew_id, null);
});

async function stockRequest(method, userId, input, id) {
  const response = await (id ? inventoryItemRoute[method] : inventoryRoute[method])(
    new NextRequest(`http://localhost/api/account/inventory${id ? `/${id}` : ""}`, {
      method, headers: { "x-inventory-fixture-user": String(userId), "Content-Type": "application/json" },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    }), { params: Promise.resolve({ stock_id: id }) });
  return { status: response.status, body: await response.json() };
}
const stockCreateInput = () => ({ operation_id: randomUUID(), stock: { name: "Clover honey", category: "honey", quantity: kg(5) } });
const stockChangeInput = (action, value, expected) => ({ operation_id: randomUUID(), action, quantity: kg(value), expected_balance: kg(expected), note: "Fixture count" });

test("stock API creates, replays, converts changes and returns owned history", async () => {
  const userId = await owner();
  const input = stockCreateInput();
  const created = await stockRequest("POST", userId, input);
  assert.equal(created.status, 201);
  assert.deepEqual(await stockRequest("POST", userId, input), created);
  const id = created.body.stockId;
  const receive = stockChangeInput("receipt", 1, 5);
  receive.quantity = { value: 1000, unit: "g" };
  assert.equal((await stockRequest("PATCH", userId, receive, id)).status, 200);
  assert.equal((await stockRequest("PATCH", userId, stockChangeInput("manual_use", 2, 6), id)).status, 200);
  assert.equal((await stockRequest("PATCH", userId, stockChangeInput("correction", 3, 4), id)).status, 200);
  const list = await stockRequest("GET", userId);
  assert.equal(list.body.can_manage, true);
  assert.equal(list.body.stock[0].quantity.value, 3);
  const history = await stockRequest("GET", userId, undefined, id);
  assert.equal(history.body.adjustments.length, 4);
  assert.equal(history.body.has_more, false);
  assert.equal(history.body.adjustments.reduce((sum, entry) => sum + entry.delta, 0), 3);
});
test("stock API rejects invalid quantities, cross-owner requests, shortages and stale balances", async () => {
  const f = await fixture();
  const foreignId = await owner();
  assert.equal((await stockRequest("GET", foreignId)).body.stock.length, 0);
  assert.equal((await stockRequest("GET", foreignId, undefined, f.stockId)).status, 404);
  assert.equal((await stockRequest("PATCH", foreignId, stockChangeInput("receipt", 1, 5), f.stockId)).status, 404);
  const invalid = stockCreateInput(); invalid.stock.quantity.value = -1;
  assert.equal((await stockRequest("POST", f.userId, invalid)).status, 400);
  assert.equal((await stockRequest("PATCH", f.userId, stockChangeInput("manual_use", 6, 5), f.stockId)).body.code, "INSUFFICIENT_STOCK");
  assert.equal(await balance(f.stockId), 5);
  const responses = await Promise.all([1, 2].map(() => stockRequest("PATCH", f.userId, stockChangeInput("receipt", 1, 5), f.stockId)));
  assert.deepEqual(responses.map((result) => result.status).sort(), [200, 409]);
  assert.equal(responses.find((result) => result.status === 409).body.code, "STALE_STOCK");
  assert.equal(await balance(f.stockId), 6);
});
test("stock removal retains history and consumption; expired accounts retain reads only", async () => {
  const f = await fixture();
  const linked = await route("POST", f, addition(1, selection(f)));
  assert.equal(linked.status, 201);
  const remove = { operation_id: randomUUID(), action: "archive" };
  assert.equal((await stockRequest("PATCH", f.userId, remove, f.stockId)).status, 200);
  assert.equal((await stockRequest("PATCH", f.userId, remove, f.stockId)).status, 200);
  assert.equal((await stockRequest("GET", f.userId)).body.stock.length, 0);
  assert.equal((await stockRequest("GET", f.userId, undefined, f.stockId)).body.adjustments.length, 2);
  assert.equal(await balance(f.stockId), 4);
  assert.equal(await prisma.inventory_consumptions.count({ where: { stock_id: f.stockId } }), 1);
  assert.equal((await stockRequest("PATCH", f.userId, stockChangeInput("receipt", 1, 4), f.stockId)).body.code, "STOCK_ARCHIVED");
  const live = await stock(f.userId);
  await prisma.premium_memberships.updateMany({ where: { user_id: f.userId }, data: { paid_through: new Date("2020-01-01") } });
  assert.equal((await stockRequest("GET", f.userId)).body.can_manage, false);
  assert.equal((await stockRequest("GET", f.userId, undefined, live.stockId)).status, 200);
  assert.equal((await stockRequest("POST", f.userId, stockCreateInput())).status, 403);
  assert.equal((await stockRequest("PATCH", f.userId, stockChangeInput("receipt", 1, 5), live.stockId)).status, 403);
  assert.equal((await stockRequest("PATCH", f.userId, { operation_id: randomUUID(), action: "archive" }, live.stockId)).status, 403);
  await prisma.users.update({ where: { id: f.userId }, data: { active: false } });
  assert.equal((await stockRequest("GET", f.userId)).status, 404);
});

test("packaging stock rejects fractional/wrong-unit writes and retains whole-unit history", async () => {
  const userId = await owner();
  const input = { operation_id: randomUUID(), stock: { name: "750 mL bottles", category: "packaging", quantity: { value: 24, unit: "units" } } };
  const added = await stockRequest("POST", userId, input);
  assert.equal(added.status, 201);
  const id = added.body.stockId;
  for (const quantity of [{ value: 0.5, unit: "units" }, { value: 2, unit: "L" }]) {
    assert.equal((await stockRequest("POST", userId, { ...input, operation_id: randomUUID(), stock: { ...input.stock, quantity } })).status, 400);
    assert.equal((await stockRequest("PATCH", userId, { operation_id: randomUUID(), action: "manual_use", quantity, expected_balance: input.stock.quantity }, id)).status, 400);
  }
  const used = await stockRequest("PATCH", userId, { operation_id: randomUUID(), action: "manual_use", quantity: { value: 6, unit: "units" }, expected_balance: input.stock.quantity }, id);
  assert.equal(used.status, 200);
  assert.equal(await balance(id), 18);
  const history = await stockRequest("GET", userId, undefined, id);
  assert.deepEqual(history.body.adjustments.map((row) => row.delta).sort((a, b) => a - b), [-6, 24]);
});
test("inventory seed creates owned ingredient and packaging stock with matching initial receipts", async () => {
  const userId = await owner();
  const otherId = await owner();
  await seedInventory(prisma, userId);
  const list = (await stockRequest("GET", userId)).body.stock;
  assert.equal(list.length, 31);
  assert.equal(list.filter((row) => row.category === "packaging").length, 8);
  const { readFile } = await import("node:fs/promises");
  const recipe = JSON.parse(await readFile(new URL("../prisma/seed-data/recipes_rows.json", import.meta.url), "utf8"))
    .find((row) => row.name === "Key Lime Pie");
  const volumeGal = JSON.parse(recipe.dataV2).ingredients
    .reduce((total, row) => total + Number(row.amounts.volume.value), 0);
  for (const sizeOz of [12, 22, 32]) {
    const bottles = list.find((row) => row.name.startsWith(`${sizeOz} fl oz`));
    assert.ok(bottles.quantity.value * sizeOz / 128 >= volumeGal,
      `${sizeOz} fl oz bottles should hold the full recipe`);
  }
  const cappedBottles = list.filter((row) => /^(12 fl oz|22 fl oz|330 mL)/.test(row.name))
    .reduce((total, row) => total + row.quantity.value, 0);
  assert.ok(list.find((row) => row.name === "Crown caps").quantity.value >= cappedBottles);
  // Exercise the real tracker path: pantry ingredients and juice must be
  // selectable, convertible and sufficient across both recipe stages.
  const { inventoryEntryLines, matchInventoryStock } = await import("@meadtools/inventory-domain");
  const data = JSON.parse(recipe.dataV2);
  const brew = await prisma.brews.create({ data: { user_id: userId } });
  const additions = [
    ...data.ingredients.map((row) => ({ kind: "INGREDIENT", name: row.name,
      amount: Number(row.amounts[row.amounts.basis].value), unit: row.amounts[row.amounts.basis].unit })),
    ...data.additives.map((row) => ({ kind: "OTHER", name: row.name, amount: Number(row.amount), unit: row.unit })),
  ];
  for (const data of additions) {
    const line = inventoryEntryLines("ADDITION", data)[0];
    const match = matchInventoryStock(list, line).stock;
    assert.ok(match, `Missing usable seed stock for ${data.name}`);
    assert.equal(match.name.toLowerCase(), data.name === "Honey" ? "wildflower honey" : data.name.toLowerCase());
    const response = await route("POST", { userId, brewId: brew.id }, {
      type: "ADDITION", client_entry_id: randomUUID(), data,
      inventory: { mode: "deduct", operation_id: randomUUID(), stock_id: match.id, expected: null },
    });
    assert.equal(response.status, 201, `Cannot use seed stock for ${data.name}: ${JSON.stringify(response.body)}`);
  }
  assert.equal((await stockRequest("GET", otherId)).body.stock.length, 0);
  for (const row of list) {
    const history = (await stockRequest("GET", userId, undefined, row.id)).body.adjustments;
    const receipt = history.find((adjustment) => adjustment.kind === "receipt");
    assert.equal(receipt.delta, row.quantity.value);
    assert.equal(receipt.balance_after.unit, row.quantity.unit);
  }
});

async function trackerInventory(userId, brewId) {
  const response = await brewInventoryRoute.GET(new NextRequest(`http://localhost/api/brews/${brewId}/inventory`, {
    headers: { "x-inventory-fixture-user": String(userId) },
  }), { params: Promise.resolve({ brew_id: brewId }) });
  return { status: response.status, body: await response.json() };
}
test("brew tracker context hides deductions and all equipment history without premium", async () => {
  const f = await fixture();
  const added = await route("POST", f, addition(1, selection(f)));
  assert.equal(added.status, 201);
  const vessel = await equipmentRequest("POST", f.userId, vesselInput());
  assert.equal((await equipmentRequest("PATCH", f.userId, assignInput(f.brewId), vessel.body.equipment.id)).status, 200);
  const context = await trackerInventory(f.userId, f.brewId);
  assert.equal(context.status, 200);
  assert.equal(context.body.can_manage, true);
  assert.equal(context.body.usages.length, 1);
  assert.deepEqual(context.body.usages[0].deducted, kg(1));
  assert.equal(context.body.vessel_events[0].action, "assigned");
  const otherId = await owner();
  assert.equal((await trackerInventory(otherId, f.brewId)).status, 404);
  assert.equal((await trackerInventory(f.userId, "not-a-uuid")).status, 400);
  await prisma.premium_memberships.updateMany({ where: { user_id: f.userId }, data: { paid_through: new Date("2020-01-01") } });
  assert.deepEqual((await trackerInventory(f.userId, f.brewId)).body, { can_manage: false, tracked_entry_ids: [], usages: [], vessel_events: [], bottlings: [], brew_name: null });
  assert.equal((await stockRequest("GET", f.userId)).body.stock.length, 1);
  assert.equal((await equipmentRequest("GET", f.userId)).body.equipment.length, 1);
  await prisma.premium_memberships.updateMany({ where: { user_id: f.userId }, data: { paid_through: new Date("2100-01-01") } });
  process.env.PREMIUM_ACCESS_ENABLED = "false";
  assert.equal((await trackerInventory(f.userId, f.brewId)).body.can_manage, false);
});
test("tracker vessel assignments can change across stages and use multiple vessels", async () => {
  const f = await fixture();
  const first = (await equipmentRequest("POST", f.userId, vesselInput())).body.equipment.id;
  const second = (await equipmentRequest("POST", f.userId, vesselInput())).body.equipment.id;
  await equipmentRequest("PATCH", f.userId, assignInput(f.brewId), first);
  await patchBrewMetadata(f.userId, f.brewId, { stage: "PRIMARY" });
  await equipmentRequest("PATCH", f.userId, assignInput(f.brewId), second);
  assert.equal(await prisma.equipment.count({ where: { current_brew_id: f.brewId } }), 2);
  await patchBrewMetadata(f.userId, f.brewId, { stage: "SECONDARY" });
  assert.equal(await prisma.equipment.count({ where: { current_brew_id: f.brewId } }), 2);
  await equipmentRequest("PATCH", f.userId, assignInput(null, f.brewId), first);
  const context = await trackerInventory(f.userId, f.brewId);
  assert.equal(context.body.vessel_events.length, 3);
  assert.equal(context.body.vessel_events.filter((event) => event.action === "released").length, 1);
  assert.equal(await prisma.equipment.count({ where: { current_brew_id: f.brewId } }), 1);
});
test("brew stock context follows linked corrections and reversals, and rejects blended deductions", async () => {
  const f = await fixture();
  const input = addition(1, selection(f));
  assert.equal((await route("POST", f, input)).status, 201);
  const entryId = input.client_entry_id;
  let context = (await trackerInventory(f.userId, f.brewId)).body;
  assert.equal(context.usages[0].entry_id, entryId);
  const correction = { data: { kind: "INGREDIENT", name: "Honey", amount: 2, unit: "kg" }, inventory: selection(f, 1) };
  assert.equal((await route("PATCH", f, correction, entryId)).status, 200);
  context = (await trackerInventory(f.userId, f.brewId)).body;
  assert.deepEqual(context.usages[0].deducted, kg(2));
  assert.equal((await route("DELETE", f, { inventory: selection(f, 2) }, entryId)).status, 200);
  assert.equal((await trackerInventory(f.userId, f.brewId)).body.usages.length, 0);
  assert.equal(await balance(f.stockId), 5);
  const blended = addition(1, selection(f));
  blended.data.meta = { components: [{ name: "A", amount: 0.5 }, { name: "B", amount: 0.5 }] };
  assert.equal((await route("POST", f, blended)).status, 400);
  assert.equal(await balance(f.stockId), 5);
});

async function metadataRequest(f, input) {
 const response=await brewMetadataRoute.PATCH(new NextRequest(`http://localhost/api/brews/${f.brewId}`,{method:'PATCH',headers:{'Content-Type':'application/json','x-inventory-fixture-user':String(f.userId)},body:JSON.stringify(input)}),{params:Promise.resolve({brew_id:f.brewId})});
 return {status:response.status,body:await response.json()};
}
test('six identical containers form a pool with optional labels, quantities and independent occupancy',async()=>{
 const f=await fixture();
 const input={...vesselInput(),quantity:6};
 const created=await equipmentRequest('POST',f.userId,input);assert.equal(created.status,201);
 assert.equal((await equipmentRequest('POST',f.userId,input)).status,201);
 const groupId=created.body.equipment.group_id;
 let units=(await equipmentRequest('GET',f.userId)).body.equipment.filter(unit=>unit.group_id===groupId);
 assert.equal(units.length,6);assert.ok(units.every(unit=>unit.name===input.equipment.name && unit.label===null));
 assert.equal((await equipmentRequest('PATCH',f.userId,{action:'label',operation_id:randomUUID(),label:'Blue lid'},units[0].id)).status,200);
 const assignment={action:'allocate',operation_id:randomUUID(),brew_id:f.brewId,quantity:2,expected_ids:[]};
 assert.equal((await equipmentRequest('PATCH',f.userId,assignment,units[0].id)).status,200);
 assert.equal((await equipmentRequest('PATCH',f.userId,assignment,units[0].id)).status,200);
 units=(await equipmentRequest('GET',f.userId)).body.equipment;
 assert.equal(units.filter(unit=>unit.brew?.id===f.brewId).length,2);assert.equal(units.filter(unit=>!unit.brew).length,4);
 const tooSmall={action:'edit_group',operation_id:randomUUID(),quantity:1,equipment:input.equipment};
 assert.equal((await equipmentRequest('PATCH',f.userId,tooSmall,units[0].id)).status,409);
 assert.equal((await equipmentRequest('PATCH',f.userId,{action:'archive_group',operation_id:randomUUID()},units[0].id)).status,409);
 assert.equal((await equipmentRequest('PATCH',f.userId,{action:'allocate',operation_id:randomUUID(),brew_id:f.brewId,quantity:7,expected_ids:units.filter(unit=>unit.brew).map(unit=>unit.id)},units[0].id)).status,409);
});
test('stage and container changes are atomic, owned, retryable and reject stale or occupied units',async()=>{
 const f=await fixture();const other=await fixture();
 const one=(await equipmentRequest('POST',f.userId,{...vesselInput(),quantity:2})).body.equipment;
 const units=(await equipmentRequest('GET',f.userId)).body.equipment;
 const change={stage:'PRIMARY',containers:{operation_id:randomUUID(),expected_ids:[],equipment_ids:units.map(unit=>unit.id)}};
 assert.equal((await metadataRequest(f,change)).status,200);assert.equal((await metadataRequest(f,change)).status,200);
 assert.equal(await prisma.brew_entries.count({where:{brew_id:f.brewId,type:'STAGE_CHANGE'}}),1);
 assert.equal(await prisma.equipment.count({where:{current_brew_id:f.brewId}}),2);
 const stale={stage:'SECONDARY',containers:{operation_id:randomUUID(),expected_ids:[],equipment_ids:[]}};
 assert.equal((await metadataRequest(f,stale)).status,409);assert.equal((await prisma.brews.findUnique({where:{id:f.brewId}})).stage,'PRIMARY');
 const foreign=(await equipmentRequest('POST',other.userId,vesselInput())).body.equipment.id;
 assert.equal((await metadataRequest(f,{stage:'SECONDARY',containers:{operation_id:randomUUID(),expected_ids:units.map(unit=>unit.id),equipment_ids:[foreign]}})).status,404);
 const secondBrew=await prisma.brews.create({data:{user_id:f.userId,name:'Other batch'}});
 const competing={...f,brewId:secondBrew.id};
 assert.equal((await metadataRequest(competing,{stage:'PRIMARY',containers:{operation_id:randomUUID(),expected_ids:[],equipment_ids:[one.id]}})).status,409);
 await prisma.premium_memberships.updateMany({where:{user_id:f.userId},data:{paid_through:new Date('2020-01-01')}});
 assert.equal((await metadataRequest(f,{stage:'SECONDARY',containers:{operation_id:randomUUID(),expected_ids:units.map(unit=>unit.id),equipment_ids:[]}})).status,403);
 assert.equal((await metadataRequest(f,{stage:'SECONDARY'})).status,200);
 assert.equal(await prisma.equipment.count({where:{current_brew_id:f.brewId}}),2);
});
test('concurrent brews cannot overbook an identical-container pool',async()=>{
 const f=await fixture(); const created=(await equipmentRequest('POST',f.userId,{...vesselInput(),quantity:6})).body.equipment;
 const second=await prisma.brews.create({data:{user_id:f.userId,name:'Concurrent batch'}});
 const results=await Promise.all([f.brewId,second.id].map(brew_id=>equipmentRequest('PATCH',f.userId,{action:'allocate',operation_id:randomUUID(),brew_id,quantity:5,expected_ids:[]},created.id)));
 assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
 assert.equal(await prisma.equipment.count({where:{current_brew_id:{not:null}}}),5);
});
test('group quantities grow and shrink without losing occupied units, labels or retry safety',async()=>{
 const f=await fixture();const input={...vesselInput(),quantity:6};const first=(await equipmentRequest('POST',f.userId,input)).body.equipment;
 assert.equal((await equipmentRequest('POST',f.userId,{...input,quantity:0})).status,400);
 await equipmentRequest('PATCH',f.userId,{action:'label',operation_id:randomUUID(),label:'Blue lid'},first.id);
 await equipmentRequest('PATCH',f.userId,{action:'allocate',operation_id:randomUUID(),brew_id:f.brewId,quantity:2,expected_ids:[]},first.id);
 const grow={action:'edit_group',operation_id:randomUUID(),quantity:8,equipment:{...input.equipment,name:'Five gallon buckets'}};
 assert.equal((await equipmentRequest('PATCH',f.userId,grow,first.id)).status,200);assert.equal((await equipmentRequest('PATCH',f.userId,grow,first.id)).status,200);
 let units=(await equipmentRequest('GET',f.userId)).body.equipment;assert.equal(units.length,8);assert.ok(units.every(unit=>unit.name==='Five gallon buckets'));assert.equal(units.filter(unit=>unit.label==='Blue lid').length,1);
 const shrink={...grow,operation_id:randomUUID(),quantity:4};assert.equal((await equipmentRequest('PATCH',f.userId,shrink,first.id)).status,200);
 units=(await equipmentRequest('GET',f.userId)).body.equipment;assert.equal(units.length,4);assert.equal(units.filter(unit=>unit.brew).length,2);assert.equal(units.filter(unit=>unit.label==='Blue lid').length,1);
 const current=units.filter(unit=>unit.brew).map(unit=>unit.id);
 assert.equal((await equipmentRequest('PATCH',f.userId,{action:'allocate',operation_id:randomUUID(),brew_id:f.brewId,quantity:0,expected_ids:current},units[0].id)).status,200);
 assert.equal((await equipmentRequest('PATCH',f.userId,{action:'archive_group',operation_id:randomUUID()},units[0].id)).status,200);
 assert.equal((await equipmentRequest('GET',f.userId)).body.equipment.length,0);assert.equal(await prisma.equipment.count(),8);assert.ok(await prisma.equipment_assignment_events.count()>=4);
});
test('container history groups the full quantity before limiting recent changes',async()=>{
 const f=await fixture();const item=(await equipmentRequest('POST',f.userId,{...vesselInput(),quantity:100})).body.equipment;
 assert.equal((await equipmentRequest('PATCH',f.userId,{action:'allocate',operation_id:randomUUID(),brew_id:f.brewId,quantity:100,expected_ids:[]},item.id)).status,200);
 const context=(await trackerInventory(f.userId,f.brewId)).body;
 assert.equal(context.vessel_events.length,1);assert.equal(context.vessel_events[0].quantity,100);
});

const multiSelection=(items,expected=[])=>({mode:'items',operation_id:randomUUID(),items,expected});
async function batchRequest(f,entries,operationId=randomUUID()) {
 const req=new NextRequest(`http://localhost/api/brews/${f.brewId}/entries/batch`,{method:'POST',headers:{'Content-Type':'application/json','x-inventory-fixture-user':String(f.userId)},body:JSON.stringify({operation_id:operationId,entries})});
 const response=await batchRoute.POST(req,{params:Promise.resolve({brew_id:f.brewId})});return {status:response.status,body:await response.json()};
}
test('multi-component nutrient uses edit and reverse each stock together',async()=>{
 const f=await fixture();const a=await service.createStock(f.userId,randomUUID(),{name:'Fermaid O',category:'additive',quantity:{value:10,unit:'g'},catalogReference:{catalog:'nutrient',id:'fermO'}});const b=await service.createStock(f.userId,randomUUID(),{name:'Fermaid K',category:'additive',quantity:{value:10,unit:'g'}});
 const id=randomUUID();const data={name:'Nutrient addition 1',kind:'NUTRIENT',meta:{components:[{key:'fermO',name:'Fermaid O',amount:2,unit:'g'},{key:'fermK',name:'Fermaid K',amount:3,unit:'g'}]}};
 const items=[{line_key:'component:fermO',stock_id:a.stockId},{line_key:'component:fermK',stock_id:b.stockId}];
 const created=await route('POST',f,{type:'ADDITION',client_entry_id:id,data,inventory:multiSelection(items)});assert.equal(created.status,201,JSON.stringify(created.body));assert.equal(await balance(a.stockId),8);assert.equal(await balance(b.stockId),7);
 const context=await trackerInventory(f.userId,f.brewId);const expected=context.body.usages.map(({line_key,stock_id,deducted})=>({line_key,stock_id,deducted}));assert.equal(expected.length,2);assert.deepEqual(context.body.usages.map(use=>use.line_name).sort(),['Fermaid K','Fermaid O']);
 const oldClient=await route('DELETE',f,{inventory:selection({...f,stockId:a.stockId},2)},id);assert.equal(oldClient.status,409);
 const removed=await route('DELETE',f,{inventory:multiSelection([],expected)},id);assert.equal(removed.status,200,JSON.stringify(removed.body));assert.equal(await balance(a.stockId),10);assert.equal(await balance(b.stockId),10);
});
test('batch shares one ledger row per stock, replays safely and rolls back a late shortage',async()=>{
 const f=await fixture();const entries=[2,2].map(amount=>addition(amount,multiSelection([{line_key:'addition',stock_id:f.stockId}])));const op=randomUUID();const first=await batchRequest(f,entries,op);assert.equal(first.status,201,JSON.stringify(first.body));assert.equal(await balance(f.stockId),1);assert.equal((await batchRequest(f,entries,op)).status,201);assert.equal(await balance(f.stockId),1);
 const operation=await prisma.inventory_operations.findUniqueOrThrow({where:{user_id_operation_key:{user_id:f.userId,operation_key:op}}});const adjustments=await prisma.inventory_adjustments.findMany({where:{operation_id:operation.id}});assert.equal(adjustments.length,1);assert.equal(adjustments[0].delta.toNumber(),-4);
 const failing=[.5,1].map(amount=>addition(amount,multiSelection([{line_key:'addition',stock_id:f.stockId}])));const failed=await batchRequest(f,failing);assert.equal(failed.status,409,JSON.stringify(failed.body));assert.equal(await balance(f.stockId),1);assert.equal(await prisma.brew_entries.count({where:{id:{in:failing.map(entry=>entry.client_entry_id)}}}),0);
});
test('packaging bottle and closure counts are corrected and reversed independently',async()=>{
 const f=await fixture();const bottles=await service.createStock(f.userId,randomUUID(),{name:'750 mL bottles',category:'packaging',quantity:{value:20,unit:'units'}});const corks=await service.createStock(f.userId,randomUUID(),{name:'Corks',category:'packaging',quantity:{value:20,unit:'units'}});const id=randomUUID();const data={packagedVolumeLiters:3,bottleRows:[{label:'750',quantity:4,sizeLiters:.75}],closures:[{name:'Corks',quantity:4}]};const items=[{line_key:'bottle:0',stock_id:bottles.stockId},{line_key:'closure:0',stock_id:corks.stockId}];
 assert.equal((await route('POST',f,{type:'PACKAGING',client_entry_id:id,data,inventory:multiSelection(items)})).status,201);assert.equal(await balance(bottles.stockId),16);assert.equal(await balance(corks.stockId),16);
 const expected=(await trackerInventory(f.userId,f.brewId)).body.usages.map(({line_key,stock_id,deducted})=>({line_key,stock_id,deducted}));const next={...data,bottleRows:[{label:'750',quantity:2,sizeLiters:.75}],closures:[{name:'Corks',quantity:2}]};assert.equal((await route('PATCH',f,{data:next,inventory:multiSelection(items,expected)},id)).status,200);assert.equal(await balance(bottles.stockId),18);assert.equal(await balance(corks.stockId),18);
 const snapshot=(await trackerInventory(f.userId,f.brewId)).body.usages.map(({line_key,stock_id,deducted})=>({line_key,stock_id,deducted}));assert.equal((await route('DELETE',f,{inventory:multiSelection([],snapshot)},id)).status,200);assert.equal(await balance(bottles.stockId),20);assert.equal(await balance(corks.stockId),20);
});
test('catalog details preserve quantity and validate the reference',async()=>{
 const f=await fixture();const input={action:'details',operation_id:randomUUID(),name:'My honey',catalogReference:null,notes:'Opened'};const response=await stockRequest('PATCH',f.userId,input,f.stockId);assert.equal(response.status,200);assert.equal(await balance(f.stockId),5);assert.equal((await stockRequest('PATCH',f.userId,input,f.stockId)).status,200);
 assert.equal((await stockRequest('PATCH',f.userId,{...input,operation_id:randomUUID(),catalogReference:{catalog:'nutrient',id:'fermO'}},f.stockId)).status,400);
});

test('stabilization batch tracks powders and partial Campden tablets in their own units',async()=>{
 const f=await fixture();const sorbate=await service.createStock(f.userId,randomUUID(),{name:'Sorbate jar',category:'additive',catalogReference:{catalog:'additive',id:'potassiumSorbate'},quantity:{value:10,unit:'g'}});const campden=await service.createStock(f.userId,randomUUID(),{name:'Campden tub',category:'additive',catalogReference:{catalog:'additive',id:'campdenPotassium'},quantity:{value:20,unit:'units'}});
 const entries=[{kind:'sorbate',amount:2,unit:'g',stockId:sorbate.stockId},{kind:'sulfite',amount:.5,unit:'tablets',stockId:campden.stockId}].map(item=>({type:'ADDITION',client_entry_id:randomUUID(),data:{name:'Stabilizer',kind:'OTHER',amount:item.amount,unit:item.unit,meta:{stabilizerKind:item.kind,stabilizerType:'kmeta',sulfiteForm:'campden'}},inventory:multiSelection([{line_key:'addition',stock_id:item.stockId}])}));
 const saved=await batchRequest(f,entries);assert.equal(saved.status,201,JSON.stringify(saved.body));assert.equal(await balance(sorbate.stockId),8);assert.equal(await balance(campden.stockId),19.5);
});
test('premium expiry rejects batches without entries or deductions',async()=>{
 const f=await fixture();await prisma.premium_memberships.deleteMany({where:{user_id:f.userId}});const entries=[addition(2,multiSelection([{line_key:'addition',stock_id:f.stockId}]))];const saved=await batchRequest(f,entries);assert.equal(saved.status,403);assert.equal(await balance(f.stockId),5);assert.equal(await prisma.brew_entries.count({where:{brew_id:f.brewId}}),0);
});
test('concurrent batches cannot overspend shared stock',async()=>{
 const f=await fixture();const make=()=>[addition(3,multiSelection([{line_key:'addition',stock_id:f.stockId}]))];const results=await Promise.all([batchRequest(f,make()),batchRequest(f,make())]);assert.deepEqual(results.map(result=>result.status).sort(),[201,409]);assert.equal(await balance(f.stockId),2);assert.equal(await prisma.brew_entries.count({where:{brew_id:f.brewId}}),1);
});

async function transferRequest(userId,input){const response=await inventoryTransferRoute.POST(new NextRequest('http://localhost/api/account/inventory/transfer',{method:'POST',headers:{'Content-Type':'application/json','x-inventory-fixture-user':String(userId)},body:JSON.stringify(input)}));return {status:response.status,body:await response.json()};}
const transferStock=(name='Imported honey',value=2)=>({name,category:'honey',quantity:kg(value),notes:null,catalogReference:null});
const importRequest=(rows,mode='create',operation_id=randomUUID())=>({action:'import',operation_id,mode,rows});
test('inventory imports preserve separate lots, audit starting quantities and replay exactly once',async()=>{
 const userId=await owner();const input=importRequest([2,3,0].map((value,index)=>({row_number:index+2,stock:transferStock('Same name',value)})));const first=await transferRequest(userId,input);assert.equal(first.status,200,JSON.stringify(first.body));assert.deepEqual(first.body,{kind:'imported',created:3,updated:0});assert.deepEqual(await transferRequest(userId,input),first);assert.equal(await prisma.inventory_stock.count({where:{user_id:userId}}),3);assert.equal(await prisma.inventory_adjustments.count({where:{user_id:userId}}),2);
 const changed=await transferRequest(userId,{...input,rows:[{row_number:2,stock:transferStock('Different')}]});assert.equal(changed.status,409);assert.equal(await prisma.inventory_stock.count({where:{user_id:userId}}),3);
});
test('inventory import rolls back all rows on invalid catalog identity and reports its row',async()=>{
 const userId=await owner();const input=importRequest([{row_number:2,stock:transferStock()},{row_number:3,stock:{name:'Nutrients',category:'additive',quantity:{value:5,unit:'g'},catalogReference:{catalog:'nutrient',id:'unknown'}}}]);const result=await transferRequest(userId,input);assert.equal(result.status,400,JSON.stringify(result.body));assert.equal(result.body.row_number,3);assert.equal(await prisma.inventory_stock.count({where:{user_id:userId}}),0);assert.equal(await prisma.inventory_operations.count({where:{user_id:userId}}),0);
});
test('explicit inventory updates use absolute corrections and immutable review snapshots',async()=>{
 const f=await fixture();const previous=(await stockRequest('GET',f.userId)).body.stock.find(item=>item.id===f.stockId);const {id,reconciliation_required,...expected}=previous;
 const input=importRequest([{row_number:2,stock_id:id,expected,stock:{...expected,name:'Renamed honey',quantity:kg(3)}}],'update');const result=await transferRequest(f.userId,input);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(await balance(id),3);assert.equal((await transferRequest(f.userId,input)).status,200);assert.equal(await balance(id),3);const stale=await transferRequest(f.userId,{...input,operation_id:randomUUID()});assert.equal(stale.status,409);assert.equal(stale.body.code,'STALE_STOCK');assert.equal(stale.body.row_number,2);const history=(await stockRequest('GET',f.userId,undefined,id)).body.adjustments;assert.equal(history.filter(row=>row.kind==='correction').length,1);assert.equal(history.find(row=>row.kind==='correction').delta,-2);
});
test('foreign IDs, duplicate updates, create-mode IDs and reconciliation cannot bypass import rules',async()=>{
 const f=await fixture();const other=await fixture();const prior=(await stockRequest('GET',f.userId)).body.stock[0];const {id,reconciliation_required,...expected}=prior;
 assert.equal((await transferRequest(other.userId,importRequest([{row_number:2,stock_id:id,expected,stock:expected}],'update'))).status,404);
 assert.equal((await transferRequest(f.userId,importRequest([{row_number:2,stock_id:id,expected,stock:expected}]))).status,400);
 assert.equal((await transferRequest(f.userId,importRequest([2,3].map(row_number=>({row_number,stock_id:id,expected,stock:expected})),'update'))).status,400);
 await prisma.inventory_stock.update({where:{id},data:{reconciliation_required:true}});assert.equal((await transferRequest(f.userId,importRequest([{row_number:2,stock_id:id,expected,stock:expected}],'update'))).body.code,'RECONCILIATION_REQUIRED');assert.equal(await balance(id),5);
});
test('expired accounts can export owned stock but cannot inspect files or import',async()=>{
 const f=await fixture();const other=await fixture();await prisma.premium_memberships.deleteMany({where:{user_id:f.userId}});const exported=await transferRequest(f.userId,{action:'export',format:'csv',template:false});assert.equal(exported.status,200);const csv=Buffer.from(exported.body.content,'base64').toString();assert.ok(csv.includes(f.stockId));assert.ok(!csv.includes(other.stockId));assert.equal((await transferRequest(f.userId,importRequest([{row_number:2,stock:transferStock()}]))).status,403);assert.equal((await transferRequest(f.userId,{action:'inspect',filename:'stock.csv',content:Buffer.from('Name,Quantity\nHoney,1').toString('base64'),delimiter:'auto'})).status,403);
});
test('a 1000-row import uses bounded bulk writes and keeps replay-safe audit balances',async()=>{
 const userId=await owner();const input=importRequest(Array.from({length:1000},(_,index)=>({row_number:index+2,stock:transferStock(`Lot ${index}`,1)})));const started=Date.now();const saved=await transferRequest(userId,input);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.created,1000);assert.equal(await prisma.inventory_adjustments.count({where:{user_id:userId}}),1000);assert.equal(await prisma.inventory_stock.count({where:{user_id:userId}}),1000);console.log(`1000-row import fixture completed in ${Date.now()-started}ms`);
});

test('import rolls back inserted stock when a late audit insert fails',async()=>{
 const userId=await owner();
 await prisma.$executeRawUnsafe("CREATE FUNCTION fixture_transfer_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.delta = 13.37 AND NEW.kind = 'receipt' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$");
 await prisma.$executeRawUnsafe('CREATE TRIGGER fixture_transfer_audit_failure BEFORE INSERT ON inventory_adjustments FOR EACH ROW EXECUTE FUNCTION fixture_transfer_audit_failure()');
 try{const result=await transferRequest(userId,importRequest([{row_number:2,stock:transferStock('First',2)},{row_number:3,stock:transferStock('Second',13.37)}]));assert.equal(result.status,500);assert.equal(await prisma.inventory_stock.count({where:{user_id:userId}}),0);assert.equal(await prisma.inventory_operations.count({where:{user_id:userId}}),0);assert.equal(await prisma.inventory_adjustments.count({where:{user_id:userId}}),0);}
 finally{await prisma.$executeRawUnsafe('DROP TRIGGER fixture_transfer_audit_failure ON inventory_adjustments');await prisma.$executeRawUnsafe('DROP FUNCTION fixture_transfer_audit_failure()');}
});
test('concurrent imported updates cannot overwrite the same reviewed balance',async()=>{
 const f=await fixture();const {id,reconciliation_required,...expected}=(await stockRequest('GET',f.userId)).body.stock[0];const results=await Promise.all([3,4].map(value=>transferRequest(f.userId,importRequest([{row_number:2,stock_id:id,expected,stock:{...expected,quantity:kg(value)}}],'update'))));assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);assert.ok([3,4].includes(await balance(id)));assert.equal(await prisma.inventory_adjustments.count({where:{stock_id:id,kind:'correction'}}),1);
});


test("an exported workbook restores inventory after a database reset with fresh stock IDs", async () => {
  const { normalizeTransferRow, suggestTransferMapping, resolveTransferStockIdentity } =
    await import("@meadtools/inventory-domain");
  const originalUser = await owner();
  const created = await service.createStock(originalUser, randomUUID(), transferStock("Restored honey", 2.75));
  const exported = await transferRequest(originalUser, {action: "export", format: "xlsx", template: false});
  assert.equal(exported.status, 200);
  // Reset only the guarded disposable fixture database, keeping the old workbook.
  await prisma.$executeRawUnsafe("TRUNCATE users CASCADE");
  const restoredUser = await owner();
  const inspected = await transferRequest(restoredUser, {
    action: "inspect", filename: exported.body.filename, content: exported.body.content, delimiter: "auto",
  });
  assert.equal(inspected.status, 200);
  const sheet = inspected.body.sheets.find(sheet => sheet.name === "Inventory");
  const mapping = suggestTransferMapping(sheet.rows[0]);
  const parsed = normalizeTransferRow(sheet.rows[1], mapping, ".");
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.stockId, created.stockId);
  const identity = resolveTransferStockIdentity("create", parsed.stockId, new Map());
  assert.equal(identity.skipByDefault, false);
  const input = importRequest([{row_number: 2, stock: parsed.stock,
    ...(identity.stockId ? {stock_id: identity.stockId} : {})}]);
  const restored = await transferRequest(restoredUser, input);
  assert.equal(restored.status, 200, JSON.stringify(restored.body));
  assert.deepEqual(restored.body, {kind: "imported", created: 1, updated: 0});
  const stock = (await stockRequest("GET", restoredUser)).body.stock;
  assert.equal(stock.length, 1);
  assert.notEqual(stock[0].id, parsed.stockId);
  assert.equal(stock[0].quantity.value, 2.75);
  assert.equal(stock[0].name, "Restored honey");
});

async function expireAndEdit(f, input, data) {
  await prisma.premium_memberships.updateMany({where:{user_id:f.userId},data:{paid_through:new Date('2000-01-01')}});
  const result = await route('PATCH', f, {data}, input.client_entry_id);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.inventory.status, 'reconciliation_required');
}
async function renew(f) {
  await prisma.premium_memberships.updateMany({where:{user_id:f.userId},data:{paid_through:new Date('2100-01-01')}});
}
async function reconciliationReview(f) {
  const response = await stockRequest('GET', f.userId, undefined, f.stockId);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.ok(response.body.reconciliation);
  return response.body.reconciliation;
}
function reconcileInput(review, quantity, operation_id=randomUUID()) {
  return {action:'reconcile',operation_id,revision:review.revision,quantity,note:'Confirmed physical count'};
}
test('renewal review confirms physical count, rebases converted uses, preserves untracked additions and retries once', async () => {
  const f=await fixture();const input=addition(1,multiSelection([{line_key:'addition',stock_id:f.stockId}]));
  assert.equal((await route('POST',f,input)).status,201);
  await expireAndEdit(f,input,{...input.data,amount:1500,unit:'g'});
  const untracked=addition(.5,{mode:'untracked'});
  assert.equal((await route('POST',f,untracked)).status,201);
  assert.equal((await stockRequest('GET',f.userId,undefined,f.stockId)).body.reconciliation,undefined);
  await renew(f);
  const review=await reconciliationReview(f);
  assert.equal(review.uses.length,1);assert.deepEqual(review.uses[0].previous,kg(1));assert.deepEqual(review.uses[0].current,kg(1.5));
  const request=reconcileInput(review,kg(3));
  const saved=await stockRequest('PATCH',f.userId,request,f.stockId);
  assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(await balance(f.stockId),3);
  assert.deepEqual(await stockRequest('PATCH',f.userId,request,f.stockId),saved);
  assert.equal((await prisma.inventory_stock.findUniqueOrThrow({where:{id:f.stockId}})).reconciliation_required,false);
  assert.equal(await prisma.inventory_consumptions.count({where:{entry_id:untracked.client_entry_id}}),0);
  const context=(await trackerInventory(f.userId,f.brewId)).body;
  const expected=context.usages.map(({line_key,stock_id,deducted})=>({line_key,stock_id,deducted}));
  const edited=await route('PATCH',f,{data:{...input.data,amount:2},inventory:multiSelection([{line_key:'addition',stock_id:f.stockId}],expected)},input.client_entry_id);
  assert.equal(edited.status,200,JSON.stringify(edited.body));assert.equal(await balance(f.stockId),2.5);
  assert.equal(await prisma.inventory_adjustments.count({where:{stock_id:f.stockId,kind:'correction'}}),1);
});
test('review closes deleted or incompatible uses without returning stock and can confirm an unchanged balance',async()=>{
  const f=await fixture();const first=addition(1,selection(f));const removed=addition(1,selection(f));
  assert.equal((await route('POST',f,first)).status,201);assert.equal((await route('POST',f,removed)).status,201);
  await expireAndEdit(f,first,{...first.data,amount:100,unit:'mL'});
  assert.equal((await route('DELETE',f,undefined,removed.client_entry_id)).status,200);
  await renew(f);const review=await reconciliationReview(f);
  assert.equal(review.uses.length,2);assert.ok(review.uses.every(use=>use.current===null));
  const saved=await stockRequest('PATCH',f.userId,reconcileInput(review,kg(3)),f.stockId);
  assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(await balance(f.stockId),3);
  assert.equal(await prisma.inventory_consumptions.count({where:{stock_id:f.stockId,reversed_at:null}}),0);
  assert.equal(await prisma.inventory_adjustments.count({where:{stock_id:f.stockId,kind:'correction'}}),0);
  assert.equal((await route('POST',f,addition(1,selection(f)))).status,201);assert.equal(await balance(f.stockId),2);
  assert.equal((await route('POST',f,{...removed,inventory:selection(f)})).status,409); // new attempts cannot resurrect retained tombstones
});
test('review rejects changed brew data even when the stock balance did not change',async()=>{
  const f=await fixture();const input=addition(1,selection(f));await route('POST',f,input);
  await expireAndEdit(f,input,{...input.data,amount:2});await renew(f);const review=await reconciliationReview(f);
  await expireAndEdit(f,input,{...input.data,amount:3});await renew(f);
  const stale=await stockRequest('PATCH',f.userId,reconcileInput(review,kg(2)),f.stockId);
  assert.equal(stale.status,409);assert.equal(stale.body.code,'STALE_STOCK');assert.equal(await balance(f.stockId),4);
  assert.equal((await prisma.inventory_stock.findUniqueOrThrow({where:{id:f.stockId}})).reconciliation_required,true);
  const current=await reconciliationReview(f);assert.notEqual(current.revision,review.revision);
  assert.equal((await stockRequest('PATCH',f.userId,reconcileInput(current,kg(2)),f.stockId)).status,200);
});
test('review enforces ownership, premium, current quantity and a single concurrent confirmation',async()=>{
  const f=await fixture();const other=await owner();const input=addition(1,selection(f));await route('POST',f,input);
  await expireAndEdit(f,input,{...input.data,amount:2});await renew(f);const review=await reconciliationReview(f);
  assert.equal((await stockRequest('PATCH',other,reconcileInput(review,kg(3)),f.stockId)).status,404);
  await prisma.premium_memberships.deleteMany({where:{user_id:f.userId}});
  assert.equal((await stockRequest('PATCH',f.userId,reconcileInput(review,kg(3)),f.stockId)).status,403);
  await prisma.premium_memberships.create({data:{user_id:f.userId,source:'manual',paid_through:new Date('2100-01-01')}});
  assert.equal((await stockRequest('PATCH',f.userId,reconcileInput(review,{value:3,unit:'L'}),f.stockId)).status,400);
  const competing=await Promise.all([2,3].map(value=>stockRequest('PATCH',f.userId,reconcileInput(review,kg(value)),f.stockId)));
  assert.deepEqual(competing.map(item=>item.status).sort(),[200,409]);
  assert.equal(await prisma.inventory_operations.count({where:{user_id:f.userId,adjustments:{some:{kind:'correction'}}}}),1);
});
test('packaging snapshots from successive saves permit repeated edits with exact inventory deltas',async()=>{
  const {captureStockChoiceBaseline}=await import('../lib/brews/stockChoiceBaseline.ts');
  const f=await fixture();const item=await service.createStock(f.userId,randomUUID(),{name:'Bottles',category:'packaging',quantity:{value:20,unit:'units'}});
  const entryId=randomUUID();const data={packagedVolumeLiters:3,bottleRows:[{label:'750',quantity:4,sizeLiters:.75}],closures:[]};
  const selection=()=>[{line_key:'bottle:0',stock_id:item.stockId}];
  assert.equal((await route('POST',f,{type:'PACKAGING',client_entry_id:entryId,data,inventory:multiSelection(selection())})).status,201);
  let snapshot=captureStockChoiceBaseline(entryId,(await trackerInventory(f.userId,f.brewId)).body);
  assert.equal(snapshot.tracked,true);
  for(const quantity of [5,6]){
    const expected=snapshot.uses.map(({line_key,stock_id,deducted})=>({line_key,stock_id,deducted}));
    const result=await route('PATCH',f,{data:{...data,bottleRows:[{...data.bottleRows[0],quantity}]},inventory:multiSelection(selection(),expected)},entryId);
    assert.equal(result.status,200,JSON.stringify(result.body));
    snapshot=captureStockChoiceBaseline(entryId,(await trackerInventory(f.userId,f.brewId)).body);
    assert.equal(snapshot.uses[0].deducted.value,quantity);assert.equal(await balance(item.stockId),20-quantity);
  }
});

test('a failed reconciliation audit rolls back link baselines, balance, review flag and retry receipt',async()=>{
  const f=await fixture();const input=addition(1,selection(f));await route('POST',f,input);
  await expireAndEdit(f,input,{...input.data,amount:2});await renew(f);const review=await reconciliationReview(f);
  const operationId=randomUUID();
  await prisma.$executeRawUnsafe("CREATE FUNCTION fixture_reconcile_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.delta = 13.37 AND NEW.kind = 'correction' THEN RAISE EXCEPTION 'fixture reconciliation failure'; END IF; RETURN NEW; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER fixture_reconcile_audit_failure BEFORE INSERT ON inventory_adjustments FOR EACH ROW EXECUTE FUNCTION fixture_reconcile_audit_failure()');
  try{
    const result=await stockRequest('PATCH',f.userId,reconcileInput(review,kg(17.37),operationId),f.stockId);
    assert.equal(result.status,500);assert.equal(await balance(f.stockId),4);
    const use=await prisma.inventory_consumptions.findFirstOrThrow({where:{stock_id:f.stockId}});
    assert.equal(use.deducted.toNumber(),1);assert.equal(use.reversed_at,null);
    assert.equal((await prisma.inventory_stock.findUniqueOrThrow({where:{id:f.stockId}})).reconciliation_required,true);
    assert.equal(await prisma.inventory_operations.count({where:{operation_key:operationId}}),0);
  }finally{
    await prisma.$executeRawUnsafe('DROP TRIGGER fixture_reconcile_audit_failure ON inventory_adjustments');
    await prisma.$executeRawUnsafe('DROP FUNCTION fixture_reconcile_audit_failure()');
  }
});

test('packaging creation with a lost response cannot create a second entry or deduction on retry',async()=>{
  const {packagingEntryIdentity}=await import('../lib/brews/stockChoiceBaseline.ts');
  const f=await fixture();const bottles=await service.createStock(f.userId,randomUUID(),{name:'Bottles',category:'packaging',quantity:{value:20,unit:'units'}});
  const pending={current:null};
  const data={packagedVolumeLiters:3,bottleRows:[{label:'750',quantity:4,sizeLiters:.75}],closures:[]};
  const inventory=multiSelection([{line_key:'bottle:0',stock_id:bottles.stockId}]);
  const first=await route('POST',f,{type:'PACKAGING',client_entry_id:packagingEntryIdentity(pending),data,inventory});
  assert.equal(first.status,201);
  // Treat the response as lost: no latest entry in the UI and pending ID intact.
  const retry=await route('POST',f,{type:'PACKAGING',client_entry_id:packagingEntryIdentity(pending),data,inventory});
  assert.equal(retry.status,201,JSON.stringify(retry.body));
  assert.equal(await prisma.brew_entries.count({where:{brew_id:f.brewId,type:'PACKAGING'}}),1);
  assert.equal(await balance(bottles.stockId),16);
  // Even a changed retry intent must not create another entry with a new ID.
  const changed=await route('POST',f,{type:'PACKAGING',client_entry_id:packagingEntryIdentity(pending),data:{...data,bottleRows:[{...data.bottleRows[0],quantity:5}]},inventory:multiSelection([{line_key:'bottle:0',stock_id:bottles.stockId}])});
  assert.equal(changed.status,400);assert.equal(changed.body.code,'ENTRY_MISMATCH');assert.equal(await balance(bottles.stockId),16);
});

async function meadRequest(method, userId, input, id) {
  const response = await (id ? finishedMeadRoute : finishedMeadsRoute)[method](
    new NextRequest(`http://localhost/api/account/inventory/meads${id ? `/${id}` : ''}`, {
      method, headers: { 'x-inventory-fixture-user': String(userId), 'Content-Type': 'application/json' },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    }), { params: Promise.resolve({ mead_id: id }) });
  return { status: response.status, body: await response.json() };
}
const meadInput = () => ({ operation_id: randomUUID(), mead: { name: 'House traditional', bottles: [
  { size_liters: .75, quantity: 10 }, { size_liters: .375, quantity: 4 },
] } });
async function meadFixture() {
  const userId = await owner();
  const input = meadInput();
  const created = await meadRequest('POST', userId, input);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.mead_id;
  const read = async () => (await meadRequest('GET', userId, undefined, id)).body;
  const update = async (change, revision) => meadRequest('PATCH', userId, {
    operation_id: randomUUID(), expected_revision: revision ?? (await read()).mead.revision, ...change,
  }, id);
  return { userId, input, id, read, update };
}

test('finished mead keeps sizes together, adds to existing counts and retries without duplicate stock', async () => {
  const f = await meadFixture();
  const retry = await meadRequest('POST', f.userId, f.input);
  assert.equal(retry.status, 201);
  assert.equal(retry.body.mead_id, f.id);
  assert.equal(await prisma.inventory_meads.count(), 1);
  assert.equal((await stockRequest('GET', f.userId)).body.stock.length, 0);
  assert.equal((await f.update({ action: 'receipt', size_liters: .75, quantity: 2 })).status, 200);
  assert.equal((await f.update({ action: 'receipt', size_liters: .33, quantity: 6, note: 'Another bottling' })).status, 200);
  const view = await f.read();
  assert.deepEqual(view.mead.bottles.map(b => [b.size_liters, b.quantity]), [[.33, 6], [.375, 4], [.75, 12]]);
  assert.equal(view.adjustments.length, 4);
  assert.equal(view.adjustments[0].note, 'Another bottling');
  const revision = view.mead.revision;
  const input = { operation_id: randomUUID(), expected_revision: revision, action: 'manual_use', size_liters: .75, quantity: 2, note: 'Gifted' };
  assert.equal((await meadRequest('PATCH', f.userId, input, f.id)).status, 200);
  assert.equal((await meadRequest('PATCH', f.userId, input, f.id)).status, 200);
  const latest = await f.read();
  assert.equal(latest.mead.bottles.find(b => b.size_liters === .75).quantity, 10);
  assert.equal(latest.adjustments.length, 5);
});

test('finished-mead shortages, concurrent counts and stale details cannot overwrite stock', async () => {
  const f = await meadFixture();
  const revision = (await f.read()).mead.revision;
  assert.equal((await f.update({ action: 'manual_use', size_liters: .75, quantity: 11 }, revision)).status, 409);
  assert.equal((await f.read()).mead.bottles.find(b => b.size_liters === .75).quantity, 10);
  const results = await Promise.all([1, 2].map(quantity => f.update({ action: 'manual_use', size_liters: .75, quantity }, revision)));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal((await f.update({ action: 'details', name: 'Stale edit', notes: null }, revision)).status, 409);
  assert.equal((await f.update({ action: 'correction', size_liters: .75, quantity: 0 })).status, 200);
  assert.equal((await f.update({ action: 'receipt', size_liters: .75, quantity: .5 })).status, 400);
  assert.equal((await f.update({ action: 'manual_use', size_liters: 1, quantity: 1 })).status, 404);
});

test('finished-mead ownership, expiry, archive and generic stock boundaries preserve balances and history', async () => {
  const f = await meadFixture();
  const other = await owner();
  assert.equal((await meadRequest('GET', other, undefined, f.id)).status, 404);
  const view = await f.read();
  const stockId = view.mead.bottles[0].id;
  assert.equal((await stockRequest('PATCH', f.userId, { action: 'archive', operation_id: randomUUID() }, stockId)).status, 404);
  assert.equal((await stockRequest('GET', f.userId, undefined, stockId)).status, 404);
  await prisma.premium_memberships.deleteMany({ where: { user_id: f.userId } });
  assert.equal((await meadRequest('GET', f.userId)).body.can_manage, false);
  assert.equal((await f.read()).adjustments.length, 2);
  assert.equal((await f.update({ action: 'receipt', size_liters: .75, quantity: 1 })).status, 403);
  await prisma.premium_memberships.create({ data: { user_id: f.userId, source: 'manual', external_reference: randomUUID(), paid_through: new Date('2100-01-01T00:00:00Z') } });
  assert.equal((await f.update({ action: 'archive' })).status, 200);
  assert.deepEqual((await meadRequest('GET', f.userId)).body.meads, []);
  assert.equal((await f.read()).adjustments.length, 2);
  assert.equal((await f.read()).mead.bottles.reduce((sum, b) => sum + b.quantity, 0), 14);
});

test('a failed finished-mead audit rolls back its group, all bottle counts and retry receipt', async () => {
  const userId = await owner();
  const input = meadInput();
  await prisma.$executeRawUnsafe("CREATE FUNCTION fixture_mead_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.delta = 4 THEN RAISE EXCEPTION 'fixture finished-mead audit failure'; END IF; RETURN NEW; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER fixture_mead_audit_failure BEFORE INSERT ON inventory_adjustments FOR EACH ROW EXECUTE FUNCTION fixture_mead_audit_failure()');
  try {
    assert.equal((await meadRequest('POST', userId, input)).status, 500);
    assert.equal(await prisma.inventory_meads.count(), 0);
    assert.equal(await prisma.inventory_stock.count(), 0);
    assert.equal(await prisma.inventory_operations.count(), 0);
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER fixture_mead_audit_failure ON inventory_adjustments');
    await prisma.$executeRawUnsafe('DROP FUNCTION fixture_mead_audit_failure()');
  }
  assert.equal((await meadRequest('POST', userId, input)).status, 201);
});

test('finished-mead storage constraints reject fractional bottles and foreign grouping', async () => {
  const f = await meadFixture();
  const other = await owner();
  const bottle = (await f.read()).mead.bottles[0];
  await assert.rejects(prisma.$executeRaw`UPDATE inventory_stock SET quantity=1.5 WHERE id=${bottle.id}::uuid`);
  await assert.rejects(prisma.$executeRaw`UPDATE inventory_stock SET unit='L' WHERE id=${bottle.id}::uuid`);
  await assert.rejects(prisma.$executeRaw`UPDATE inventory_stock SET user_id=${other} WHERE id=${bottle.id}::uuid`);
  await assert.rejects(prisma.$executeRaw`UPDATE inventory_stock SET bottle_size_liters=0 WHERE id=${bottle.id}::uuid`);
  assert.equal((await f.read()).mead.bottles[0].quantity, 4);
});

test('finished-mead seed keeps bottle counts and initial history scoped to its owner', async () => {
  const { seedFinishedMeads } = await import('../prisma/seed-finished-meads.ts');
  const userId = await owner();
  const other = await owner();
  await seedFinishedMeads(prisma, userId);
  const list = await meadRequest('GET', userId);
  assert.equal(list.body.meads.length, 1);
  assert.equal(list.body.meads[0].bottles.reduce((sum, b) => sum + b.quantity, 0), 18);
  assert.deepEqual((await meadRequest('GET', other)).body.meads, []);
  assert.equal((await meadRequest('GET', userId, undefined, list.body.meads[0].id)).body.adjustments.length, 2);
});

test('finished-mead revisions remain stale when a count is changed and then restored', async () => {
  const f = await meadFixture();
  const original = (await f.read()).mead;
  assert.equal((await f.update({ action: 'correction', size_liters: .375, quantity: 3 })).status, 200);
  assert.equal((await f.update({ action: 'correction', size_liters: .375, quantity: 4 })).status, 200);
  const current = (await f.read()).mead;
  assert.deepEqual(current.bottles, original.bottles);
  assert.notEqual(current.revision, original.revision);
  assert.equal((await f.update({ action: 'manual_use', size_liters: .375, quantity: 1 }, original.revision)).status, 409);
});

async function organizationRequest(userId, input) {
  const method = input ? 'PATCH' : 'GET';
  const response = await organizationRoute[method](new NextRequest('http://localhost/api/account/inventory/organization', {
    method, headers: {'x-inventory-fixture-user': String(userId), 'Content-Type': 'application/json'},
    ...(input ? {body: JSON.stringify(input)} : {}),
  }));
  return {status: response.status, body: await response.json()};
}
async function organizationChange(userId, change) {
  return organizationRequest(userId, {operation_id: randomUUID(), ...change});
}
async function location(userId, name='Cellar', parent_id=null) {
  const response = await organizationChange(userId, {action: 'create_location', name, parent_id});
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.id;
}
async function organizedStock(userId, id) {
  return (await organizationRequest(userId)).body.stock.find(row => row.id === id);
}
async function storageRequest(method, userId, stockId, input) {
  const response = await storageRoute[method](new NextRequest(`http://localhost/api/account/inventory/storage/${stockId}`, {
    method, headers: {'x-inventory-fixture-user': String(userId), 'Content-Type': 'application/json'},
    ...(input ? {body: JSON.stringify(input)} : {}),
  }), {params: Promise.resolve({stock_id: stockId})});
  return {status: response.status, body: await response.json()};
}
async function place(userId, stockId, allocations, expected) {
  const input = {operation_id: randomUUID(), expected_revision: expected ?? (await organizedStock(userId, stockId)).revision, allocations};
  return storageRequest('PATCH', userId, stockId, input);
}
const position = (location_id, quantity, name='C3') => ({location_id, quantity, position: name});

test('custom categories apply across stock and finished meads with ownership and stale selection guards', async () => {
  const f = await meadFixture();
  const honey = await stock(f.userId);
  const first = await organizationChange(f.userId, {action: 'create_label', name: 'Competition'});
  const second = await organizationChange(f.userId, {action: 'create_label', name: 'Ready'});
  assert.equal(first.status, 200);
  const ids = [first.body.id, second.body.id];
  for (const [kind,id] of [['stock',honey.stockId],['mead',f.id]]) {
    assert.equal((await organizationChange(f.userId, {action:'assign_labels',kind,id,label_ids:ids,expected_label_ids:[]})).status,200);
    assert.equal((await organizationChange(f.userId, {action:'assign_labels',kind,id,label_ids:[],expected_label_ids:[]})).status,409);
  }
  assert.equal((await organizationRequest(f.userId)).body.assignments.length,2);
  assert.equal((await organizationChange(f.userId,{action:'create_label',name:' competition '})).status,400);
  const other = await owner();
  assert.deepEqual((await organizationRequest(other)).body.labels,[]);
  assert.equal((await organizationChange(other,{action:'assign_labels',kind:'mead',id:f.id,label_ids:ids,expected_label_ids:[]})).status,404);
  assert.equal((await organizationChange(f.userId,{action:'edit_label',id:first.body.id,name:'For competitions',expected_version:0})).status,200);
  assert.equal((await organizationChange(f.userId,{action:'archive_label',id:first.body.id,expected_version:0})).status,409);
  assert.equal(await balance(honey.stockId),5);
});

test('storage moves preserve total stock, replay once and reject stale, foreign or excessive allocations',async()=>{
  const f=await fixture();const room=await location(f.userId);const box=await location(f.userId,'Box A2',room);
  const initial=await organizedStock(f.userId,f.stockId);
  const input={operation_id:randomUUID(),expected_revision:initial.revision,allocations:[position(box,3)]};
  assert.equal((await storageRequest('PATCH',f.userId,f.stockId,input)).status,200);
  assert.equal((await storageRequest('PATCH',f.userId,f.stockId,input)).status,200);
  assert.equal(await balance(f.stockId),5);
  assert.equal((await storageRequest('GET',f.userId,f.stockId)).body.changes.length,1);
  assert.equal((await place(f.userId,f.stockId,[position(box,2)],initial.revision)).status,409);
  assert.equal((await place(f.userId,f.stockId,[position(box,6)])).status,409);
  const other=await owner();const foreign=await location(other);
  assert.equal((await place(f.userId,f.stockId,[position(foreign,2)])).status,404);
  assert.equal((await storageRequest('GET',other,f.stockId)).status,404);
  const revision=(await organizedStock(f.userId,f.stockId)).revision;
  const requests=await Promise.all([2,4].map(quantity=>place(f.userId,f.stockId,[position(box,quantity)],revision)));
  assert.deepEqual(requests.map(row=>row.status).sort(),[200,409]);
});

test('manual use can select a position and automatic use/corrections keep allocations within the balance',async()=>{
  const f=await fixture();const room=await location(f.userId);
  assert.equal((await place(f.userId,f.stockId,[position(room,4)])).status,200);
  const use=async(value,storage_source)=>stockRequest('PATCH',f.userId,{action:'manual_use',operation_id:randomUUID(),quantity:kg(value),expected_balance:kg(await balance(f.stockId)),...(storage_source===undefined?{}:{storage_source})},f.stockId);
  assert.equal((await use(1,{location_id:room,position:'C3'})).status,200);
  assert.equal((await organizedStock(f.userId,f.stockId)).allocations[0].quantity,3);
  assert.equal((await use(2,'unlocated')).status,409);
  assert.equal(await balance(f.stockId),4);
  assert.equal((await use(2)).status,200);
  assert.equal((await organizedStock(f.userId,f.stockId)).allocations[0].quantity,2);
  assert.equal((await stockRequest('PATCH',f.userId,{action:'correction',operation_id:randomUUID(),quantity:kg(.5),expected_balance:kg(2)},f.stockId)).status,200);
  assert.equal((await organizedStock(f.userId,f.stockId)).allocations[0].quantity,.5);
  const changes=(await storageRequest('GET',f.userId,f.stockId)).body.changes;
  assert.equal(changes.length,4);
  assert.equal(changes[0].reason,'correction');
});

test('finished bottles use a specific box and whole allocations; stored entries cannot be archived',async()=>{
  const f=await meadFixture();const box=await location(f.userId,'Competition box');
  const stockId=(await f.read()).mead.bottles.find(row=>row.size_liters===.75).id;
  assert.equal((await place(f.userId,stockId,[position(box,8)])).status,200);
  assert.equal((await place(f.userId,stockId,[position(box,1.5)])).status,400);
  assert.equal((await f.update({action:'manual_use',size_liters:.75,quantity:3,storage_source:{location_id:box,position:'C3'}})).status,200);
  assert.equal((await organizedStock(f.userId,stockId)).allocations[0].quantity,5);
  assert.equal((await f.update({action:'archive'})).status,409);
  assert.equal((await place(f.userId,stockId,[])).status,200);
  assert.equal((await f.update({action:'archive'})).status,200);
  assert.equal((await storageRequest('GET',f.userId,stockId)).body.changes.length,3);
});

test('linked brew use and its correction reduce stored consumables; reversal returns unlocated stock',async()=>{
  const f=await fixture();const room=await location(f.userId);
  await place(f.userId,f.stockId,[position(room,4)]);
  const entry=addition(2,selection(f));
  assert.equal((await route('POST',f,entry)).status,201);
  assert.equal((await organizedStock(f.userId,f.stockId)).allocations[0].quantity,3);
  assert.equal((await route('PATCH',f,{data:{...entry.data,amount:4},inventory:selection(f,2)},entry.client_entry_id)).status,200);
  assert.equal((await organizedStock(f.userId,f.stockId)).allocations[0].quantity,1);
  assert.equal((await route('DELETE',f,{inventory:selection(f,4)},entry.client_entry_id)).status,200);
  assert.equal(await balance(f.stockId),5);
  assert.equal((await organizedStock(f.userId,f.stockId)).allocations[0].quantity,1);
  const before=(await storageRequest('GET',f.userId,f.stockId)).body.changes.length;
  const batch=[4,2].map(amount=>addition(amount,multiSelection([{line_key:'addition',stock_id:f.stockId}])));
  assert.equal((await batchRequest(f,batch)).status,409);
  assert.equal(await balance(f.stockId),5);
  assert.equal((await storageRequest('GET',f.userId,f.stockId)).body.changes.length,before);
});

test('multi-line packaging updates stored bottle counts through the same transaction',async()=>{
  const f=await fixture();const bottles=await service.createStock(f.userId,randomUUID(),{name:'Bottles',category:'packaging',quantity:{value:10,unit:'units'}});
  const box=await location(f.userId);await place(f.userId,bottles.stockId,[position(box,8)]);
  const entry={type:'PACKAGING',client_entry_id:randomUUID(),data:{packagedVolumeLiters:3,bottleRows:[{label:'750',quantity:4,sizeLiters:.75}]},inventory:multiSelection([{line_key:'bottle:0',stock_id:bottles.stockId}])};
  assert.equal((await route('POST',f,entry)).status,201);
  assert.equal(await balance(bottles.stockId),6);
  assert.equal((await organizedStock(f.userId,bottles.stockId)).allocations[0].quantity,6);
});

test('location cycles, occupied archival and expiry cannot bypass ownership or retained history',async()=>{
  const f=await fixture();const room=await location(f.userId);const box=await location(f.userId,'Box A2',room);
  assert.equal((await organizationChange(f.userId,{action:'edit_location',id:room,name:'Cellar',parent_id:box,expected_version:0})).status,400);
  assert.equal((await organizationChange(f.userId,{action:'archive_location',id:room,expected_version:0})).status,409);
  await place(f.userId,f.stockId,[position(box,2)]);
  assert.equal((await organizationChange(f.userId,{action:'archive_location',id:box,expected_version:0})).status,409);
  assert.equal((await stockRequest('PATCH',f.userId,{action:'archive',operation_id:randomUUID()},f.stockId)).status,409);
  assert.equal((await organizationChange(f.userId,{action:'edit_location',id:box,name:'Box B1',parent_id:room,expected_version:0})).status,200);
  assert.equal((await storageRequest('GET',f.userId,f.stockId)).body.changes[0].location_path,'Cellar → Box A2');
  await prisma.premium_memberships.deleteMany({where:{user_id:f.userId}});
  assert.equal((await organizationRequest(f.userId)).body.can_manage,false);
  assert.equal((await place(f.userId,f.stockId,[])).status,403);
  assert.equal((await storageRequest('GET',f.userId,f.stockId)).status,200);
});

test('storage audit failure rolls back positions, movement events, revision and retry receipt',async()=>{
  const f=await fixture();const a=await location(f.userId,'A');const b=await location(f.userId,'B');
  await place(f.userId,f.stockId,[position(a,2)]);
  const before=await organizedStock(f.userId,f.stockId);
  const input={operation_id:randomUUID(),expected_revision:before.revision,allocations:[position(b,3)]};
  await prisma.$executeRawUnsafe("CREATE FUNCTION fixture_storage_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.delta = 3 THEN RAISE EXCEPTION 'fixture storage history failure'; END IF; RETURN NEW; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER fixture_storage_failure BEFORE INSERT ON inventory_storage_events FOR EACH ROW EXECUTE FUNCTION fixture_storage_failure()');
  try {
    assert.equal((await storageRequest('PATCH',f.userId,f.stockId,input)).status,500);
    assert.deepEqual(await organizedStock(f.userId,f.stockId),before);
    assert.equal(await prisma.inventory_operations.count({where:{operation_key:input.operation_id}}),0);
    assert.equal((await storageRequest('GET',f.userId,f.stockId)).body.changes.length,1);
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER fixture_storage_failure ON inventory_storage_events');
    await prisma.$executeRawUnsafe('DROP FUNCTION fixture_storage_failure()');
  }
  assert.equal((await storageRequest('PATCH',f.userId,f.stockId,input)).status,200);
});

test('organization seed creates owner-scoped categories and locations without changing stock quantities',async()=>{
  const f=await meadFixture();const honey=await stock(f.userId);const other=await owner();
  const {seedInventoryOrganization}=await import('../prisma/seed-inventory-organization.ts');
  await seedInventoryOrganization(prisma,f.userId);
  const view=(await organizationRequest(f.userId)).body;
  assert.equal(view.labels.length,2);assert.equal(view.locations.length,3);
  assert.ok(view.locations.some(row=>row.path==='Cellar → Box A2'));
  assert.equal(view.assignments.length,2);
  assert.equal(view.stock.find(row=>row.id===honey.stockId).quantity.value,5);
  assert.equal((await organizationRequest(other)).body.locations.length,0);
});

const {readBrewInventory: bottlingContext}=await import('../lib/db/brew-inventory.ts');
const {createFinishedMeadService:bottlingMeadService}=await import('../lib/db/finished-meads.ts');
function bottlingInput(quantity=12, overrides={}){
 const rowId=randomUUID(),meadId=randomUUID();
 return {type:'PACKAGING',client_entry_id:randomUUID(),data:{packagedVolumeLiters:8.5,bottleRows:[{id:rowId,label:'750 mL',quantity,sizeLiters:.75,totalLiters:quantity*.75}],closures:[]},bottling:{operation_id:randomUUID(),expected_revision:null,mode:'sync',outputs:[{row_id:rowId,quantity,target:{kind:'new',mead_id:meadId,name:'House collection'}}]},...overrides};
}
async function production(f,entryId){return (await bottlingContext(f.userId,f.brewId)).bottlings.find(row=>row.entry_id===entryId);}
async function productionStock(f,input){return prisma.inventory_stock.findFirstOrThrow({where:{user_id:f.userId,mead_id:input.bottling.outputs[0].target.mead_id}});}
function productionEdit(input,source,quantity){return {data:{...input.data,bottleRows:input.data.bottleRows.map(row=>({...row,quantity,totalLiters:quantity*row.sizeLiters}))},bottling:{operation_id:randomUUID(),expected_revision:source.revision,mode:'sync',outputs:source.outputs.map(row=>({row_id:row.row_id,quantity,target:{kind:'existing',mead_id:row.mead_id}}))}};}
test('bottling creates finished stock and measured yield atomically, replaying the operation once',async()=>{
 const f=await fixture(),input=bottlingInput();
 assert.equal((await route('POST',f,input)).status,201);
 assert.equal((await route('POST',f,input)).status,201);
 const item=await productionStock(f,input);assert.equal(await balance(item.id),12);
 assert.equal((await prisma.brews.findUniqueOrThrow({where:{id:f.brewId}})).current_volume_liters,8.5);
 assert.equal(await prisma.brew_entries.count({where:{brew_id:f.brewId,type:'VOLUME'}}),1);
 assert.equal(await prisma.inventory_bottlings.count(),1);assert.equal(await prisma.inventory_productions.count(),1);
 const retained=await prisma.inventory_bottlings.findUniqueOrThrow({where:{entry_id:input.client_entry_id}});assert.ok(Number.isFinite(Date.parse(retained.source_snapshot.datetime)));assert.equal(retained.source_snapshot.packaging.bottleRows[0].id,input.data.bottleRows[0].id);
 assert.equal((await production(f,input.client_entry_id)).outputs[0].quantity,12);
 const saved=await route('POST',f,input);assert.equal(JSON.stringify(saved.body.brew).includes(input.bottling.outputs[0].target.mead_id),false);
});
test('bottling corrections preserve later uses, reject stale snapshots and apply no repeat output',async()=>{
 const f=await fixture(),input=bottlingInput();await route('POST',f,input);
 const meads=bottlingMeadService(prisma);let item=(await meads.overview(f.userId)).meads.find(row=>row.id===input.bottling.outputs[0].target.mead_id);
 await meads.update(f.userId,item.id,{action:'manual_use',operation_id:randomUUID(),expected_revision:item.revision,size_liters:.75,quantity:2,note:null});
 const source=await production(f,input.client_entry_id),edit=productionEdit(input,source,10);
 const result=await route('PATCH',f,edit,input.client_entry_id);assert.equal(result.status,200,JSON.stringify(result.body));
 const stock=await productionStock(f,input);assert.equal(await balance(stock.id),8);
 assert.equal((await route('PATCH',f,edit,input.client_entry_id)).status,200);assert.equal(await balance(stock.id),8);
 assert.equal((await route('PATCH',f,{...edit,bottling:{...edit.bottling,operation_id:randomUUID()}},input.client_entry_id)).body.code,'STALE_USAGE');
 const current=await production(f,input.client_entry_id);const same=productionEdit(input,current,10);await route('PATCH',f,same,input.client_entry_id);assert.equal(await balance(stock.id),8);
});
test('bottling inputs and output/storage audit roll back together on an invalid destination',async()=>{
 const f=await fixture(),input=bottlingInput();const caps=await service.createStock(f.userId,randomUUID(),{name:'750 mL bottles',category:'packaging',quantity:{value:20,unit:'units'}});
 input.inventory={mode:'items',operation_id:randomUUID(),expected:[],items:[{line_key:`bottle:${input.data.bottleRows[0].id}`,stock_id:caps.stockId}]};
 input.bottling.outputs[0].location_id=randomUUID();
 const result=await route('POST',f,input);assert.equal(result.status,404,JSON.stringify(result.body));
 assert.equal(await balance(caps.stockId),20);assert.equal(await prisma.brew_entries.count(),0);assert.equal(await prisma.inventory_meads.count(),0);assert.equal(await prisma.inventory_bottlings.count(),0);
 input.bottling.outputs[0].location_id=await location(f.userId);
 assert.equal((await route('POST',f,input)).status,201);assert.equal(await balance(caps.stockId),8);
 const out=await productionStock(f,input);assert.equal((await organizedStock(f.userId,out.id)).allocations[0].quantity,12);
 const edit=productionEdit(input,await production(f,input.client_entry_id),10);edit.inventory={...input.inventory,operation_id:randomUUID(),expected:[{line_key:input.inventory.items[0].line_key,stock_id:caps.stockId,deducted:{value:12,unit:'units'}}]};
 const blocked=await route('PATCH',f,edit,input.client_entry_id);assert.equal(blocked.body.code,'STORAGE_IN_USE');assert.equal(await balance(caps.stockId),8);assert.equal(await balance(out.id),12);
});
test('missing production review cannot bypass corrections; expiry retains counts and flags reconciliation',async()=>{
 const f=await fixture(),input=bottlingInput();await route('POST',f,input);const out=await productionStock(f,input);
 assert.equal((await route('PATCH',f,{data:{...input.data,packagedVolumeLiters:7}},input.client_entry_id)).body.code,'SELECTION_REQUIRED');
 await prisma.premium_memberships.updateMany({where:{user_id:f.userId},data:{paid_through:new Date('2000-01-01')}});
 assert.equal((await route('PATCH',f,{data:{...input.data,packagedVolumeLiters:7}},input.client_entry_id)).status,200);
 assert.equal(await balance(out.id),12);assert.equal((await production(f,input.client_entry_id)).reconciliation_required,true);
 await prisma.premium_memberships.updateMany({where:{user_id:f.userId},data:{paid_through:new Date('2100-01-01')}});
 const edit=productionEdit(input,await production(f,input.client_entry_id),12);
 assert.equal((await route('PATCH',f,edit,input.client_entry_id)).body.code,'RECONCILIATION_REQUIRED');
 edit.bottling.mode='reconcile';edit.bottling.confirmed_on_hand=true;
 assert.equal((await route('PATCH',f,edit,input.client_entry_id)).status,200);assert.equal(await balance(out.id),12);assert.equal((await production(f,input.client_entry_id)).reconciliation_required,false);
});
test('older packaging requires on-hand confirmation and brew deletion retains private production snapshots',async()=>{
 const f=await fixture(),input=bottlingInput();const untracked={...input};delete untracked.bottling;await route('POST',f,untracked);
 const edit={data:input.data,bottling:input.bottling};assert.equal((await route('PATCH',f,edit,input.client_entry_id)).body.code,'RECONCILIATION_REQUIRED');
 edit.bottling.confirmed_on_hand=true;assert.equal((await route('PATCH',f,edit,input.client_entry_id)).status,200);
 const out=await productionStock(f,input);await deleteBrewForApp(f.brewId,f.userId);assert.equal(await balance(out.id),12);assert.equal(await prisma.inventory_bottlings.count(),1);
 const history=await bottlingMeadService(prisma).history(f.userId,out.mead_id);const change=history.adjustments.find(row=>row.kind==='bottling_output');assert.equal(change.source.removed,true);assert.equal(change.source.brew_id,f.brewId);
});

test('bottling splits sizes across entries and locations, with atomic source removal and packaging returns',async()=>{
 const f=await fixture(),input=bottlingInput();const row2={id:randomUUID(),label:'375 mL',quantity:4,sizeLiters:.375,totalLiters:1.5};input.data.bottleRows.push(row2);
 const secondId=randomUUID(),loc=await location(f.userId);
 const first=input.bottling.outputs[0];first.quantity=7;first.location_id=loc;
 input.bottling.outputs.push({...first,quantity:5,target:{kind:'new',mead_id:secondId,name:'Competition'},location_id:null},{row_id:row2.id,quantity:4,target:first.target});
 const caps=await service.createStock(f.userId,randomUUID(),{name:'Caps',category:'packaging',quantity:{value:20,unit:'units'}});
 input.data.closures=[{name:'Caps',quantity:16}];input.inventory={mode:'items',operation_id:randomUUID(),expected:[],items:[{line_key:`bottle:${input.data.bottleRows[0].id}`,stock_id:null},{line_key:`bottle:${row2.id}`,stock_id:null},{line_key:'closure:0',stock_id:caps.stockId}]};
 const create=await route('POST',f,input);assert.equal(create.status,201,JSON.stringify(create.body));
 const source=await production(f,input.client_entry_id);assert.equal(source.outputs.length,3);assert.equal(await balance(caps.stockId),4);
 const remove={bottling:{operation_id:randomUUID(),mode:'sync',expected_revision:source.revision,outputs:[]},inventory:{mode:'items',operation_id:randomUUID(),items:[],expected:[{line_key:'closure:0',stock_id:caps.stockId,deducted:{value:16,unit:'units'}}]}};
 assert.equal((await route('DELETE',f,remove,input.client_entry_id)).body.code,'STORAGE_IN_USE');
 for(const output of source.outputs)await place(f.userId,output.stock_id,[]);
 const deleted=await route('DELETE',f,remove,input.client_entry_id);assert.equal(deleted.status,200,JSON.stringify(deleted.body));
 assert.equal(await balance(caps.stockId),20);for(const output of source.outputs)assert.equal(await balance(output.stock_id),0);
 assert.equal(await prisma.brew_entries.count({where:{brew_id:f.brewId}}),0);
 assert.equal((await route('POST',f,{...input,inventory:undefined,bottling:undefined})).body.code,'USAGE_REMOVED');
});
test('production ownership, row identity, and concurrent corrections cannot overwrite another reviewed save',async()=>{
 const f=await fixture(),input=bottlingInput();await route('POST',f,input);const source=await production(f,input.client_entry_id);
 const [a,b]=await Promise.all([route('PATCH',f,productionEdit(input,source,10),input.client_entry_id),route('PATCH',f,productionEdit(input,source,11),input.client_entry_id)]);
 assert.deepEqual([a.status,b.status].sort(),[200,409]);
 const other=await fixture();const foreign=bottlingInput();foreign.bottling.outputs[0].target={kind:'existing',mead_id:input.bottling.outputs[0].target.mead_id};assert.equal((await route('POST',other,foreign)).status,404);
 const wrong=bottlingInput();wrong.bottling.outputs[0].row_id=randomUUID();assert.equal((await route('POST',f,wrong)).status,400);
 const duplicated=bottlingInput();duplicated.data.bottleRows.push({...duplicated.data.bottleRows[0]});assert.equal((await route('POST',f,duplicated)).status,400);
});
test('removed source warnings can be acknowledged after physical review, never replaying stock on renewal',async()=>{
 const f=await fixture(),input=bottlingInput();await route('POST',f,input);const out=await productionStock(f,input);
 await prisma.premium_memberships.updateMany({where:{user_id:f.userId},data:{paid_through:new Date('2000-01-01')}});
 const removed=await route('DELETE',f,undefined,input.client_entry_id);assert.equal(removed.status,200);assert.equal(await balance(out.id),12);
 let changes=(await organizationRequest(f.userId)).body.bottling_changes;assert.equal(changes.length,1);assert.equal(changes[0].source_missing,true);
 await prisma.premium_memberships.updateMany({where:{user_id:f.userId},data:{paid_through:new Date('2100-01-01')}});
 const change=changes[0],body={operation_id:randomUUID(),expected_revision:change.revision,confirmed_on_hand:true};
 const request=()=>bottlingChangeRoute.PATCH(new NextRequest(`http://localhost/api/account/inventory/bottlings/${change.id}`,{method:'PATCH',headers:{'x-inventory-fixture-user':String(f.userId),'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({bottling_id:change.id})});
 assert.equal((await request()).status,200);assert.equal((await request()).status,200);assert.equal(await balance(out.id),12);assert.equal((await organizationRequest(f.userId)).body.bottling_changes.length,0);
 assert.equal((await prisma.inventory_stock.findUniqueOrThrow({where:{id:out.id}})).reconciliation_required,false);
});

test('bottling seed attributes existing seed bottles without issuing another receipt',async()=>{
 const f=await fixture();const {seedFinishedMeads}=await import('../prisma/seed-finished-meads.ts');await seedFinishedMeads(prisma,f.userId);
 const before=await prisma.inventory_stock.findMany({where:{user_id:f.userId,category:'mead'},orderBy:{id:'asc'}});
 const {seedBottlingProduction}=await import('../prisma/seed-bottling-production.ts');await seedBottlingProduction(prisma,f.userId);
 const after=await prisma.inventory_stock.findMany({where:{user_id:f.userId,category:'mead'},orderBy:{id:'asc'}});
 assert.deepEqual(after.map(row=>row.quantity.toNumber()),before.map(row=>row.quantity.toNumber()));assert.equal(await prisma.inventory_bottlings.count(),1);assert.equal(await prisma.inventory_productions.count(),1);
});

test('a bottling increase places only additional bottles and preserves subsequent moves',async()=>{
 const f=await fixture(),input=bottlingInput(4),a=await location(f.userId,'Box A'),b=await location(f.userId,'Box B');input.bottling.outputs[0].location_id=a;
 assert.equal((await route('POST',f,input)).status,201);const out=await productionStock(f,input);
 await place(f.userId,out.id,[position(b,4)]);
 const edit=productionEdit(input,await production(f,input.client_entry_id),6);edit.bottling.outputs[0].location_id=a;
 assert.equal((await route('PATCH',f,edit,input.client_entry_id)).status,200);const stored=await organizedStock(f.userId,out.id);
 assert.equal(stored.allocations.find(row=>row.location_id===b).quantity,4);assert.equal(stored.allocations.find(row=>row.location_id===a).quantity,2);assert.equal(await balance(out.id),6);
});
test('a capacity change cannot erase used output or leave new stock behind on failure',async()=>{
 const f=await fixture(),input=bottlingInput(4);await route('POST',f,input);const meads=bottlingMeadService(prisma),item=(await meads.overview(f.userId)).meads[0];
 await meads.update(f.userId,item.id,{action:'manual_use',operation_id:randomUUID(),expected_revision:item.revision,size_liters:.75,quantity:3,note:null});
 const edit=productionEdit(input,await production(f,input.client_entry_id),4);edit.data.bottleRows[0].sizeLiters=.375;
 const result=await route('PATCH',f,edit,input.client_entry_id);assert.equal(result.body.code,'INSUFFICIENT_STOCK');assert.equal(await prisma.inventory_stock.count({where:{category:'mead'}}),1);assert.equal((await production(f,input.client_entry_id)).outputs[0].size_liters,.75);
});
test('finished output and source volume roll back when packaging supplies are short',async()=>{
 const f=await fixture(),input=bottlingInput(12),caps=await service.createStock(f.userId,randomUUID(),{name:'Bottles',category:'packaging',quantity:{value:3,unit:'units'}});
 input.inventory={mode:'items',operation_id:randomUUID(),expected:[],items:[{line_key:`bottle:${input.data.bottleRows[0].id}`,stock_id:caps.stockId}]};
 assert.equal((await route('POST',f,input)).body.code,'INSUFFICIENT_STOCK');assert.equal(await prisma.inventory_meads.count(),0);assert.equal(await prisma.inventory_productions.count(),0);assert.equal(await prisma.brew_entries.count(),0);assert.equal(await balance(caps.stockId),3);
});

test('the atomic bottling volume keeps the existing estimated-ABV history synchronized',async()=>{
 const f=await fixture();
 await route('POST',f,{type:'GRAVITY',gravity:1.1,datetime:'2026-01-01T00:00:00Z',data:{readingRole:'OG',source:'measured'}});
 await route('POST',f,{type:'GRAVITY',gravity:1,datetime:'2026-01-02T00:00:00Z',data:{readingRole:'FG',source:'measured'}});
 const input=bottlingInput();input.datetime='2026-01-03T00:00:00Z';
 assert.equal((await route('POST',f,input)).status,201);
 const volume=await prisma.brew_entries.findFirstOrThrow({where:{brew_id:f.brewId,type:'VOLUME'}});
 const estimates=await prisma.brew_entries.findMany({where:{brew_id:f.brewId,type:'GRAVITY',data:{path:['source'],equals:'abv_estimate'}}});
 assert.ok(estimates.some(entry=>entry.data?.abvEstimate?.eventEntryId===volume.id));
});

test('durable closure rows can be reordered or removed without confusing packaging deductions',async()=>{
 const f=await fixture(),input=bottlingInput();const capId=randomUUID(),corkId=randomUUID();
 const caps=await service.createStock(f.userId,randomUUID(),{name:'Caps',category:'packaging',quantity:{value:20,unit:'units'}}),corks=await service.createStock(f.userId,randomUUID(),{name:'Corks',category:'packaging',quantity:{value:20,unit:'units'}});
 input.data.closures=[{id:capId,name:'Caps',quantity:12},{id:corkId,name:'Corks',quantity:12}];
 input.inventory={mode:'items',operation_id:randomUUID(),expected:[],items:[{line_key:`bottle:${input.data.bottleRows[0].id}`,stock_id:null},{line_key:`closure:${capId}`,stock_id:caps.stockId},{line_key:`closure:${corkId}`,stock_id:corks.stockId}]};
 assert.equal((await route('POST',f,input)).status,201);
 const context=await bottlingContext(f.userId,f.brewId),edit=productionEdit(input,context.bottlings[0],12);edit.data.closures=[{id:capId,name:'Caps',quantity:10}];
 edit.inventory={mode:'items',operation_id:randomUUID(),expected:context.usages.map(({line_key,stock_id,deducted})=>({line_key,stock_id,deducted})),items:input.inventory.items.filter(row=>row.line_key!==`closure:${corkId}`)};
 assert.equal((await route('PATCH',f,edit,input.client_entry_id)).status,200);assert.equal(await balance(caps.stockId),10);assert.equal(await balance(corks.stockId),20);
});
test('another bottling can join the same collection, and completing or reopening never adds bottles',async()=>{
 const f=await fixture(),first=bottlingInput(4);await route('POST',f,first);const out=await productionStock(f,first);
 const second=bottlingInput(2);second.bottling.outputs[0].target={kind:'existing',mead_id:first.bottling.outputs[0].target.mead_id};
 assert.equal((await route('POST',f,second)).status,201);assert.equal(await balance(out.id),6);assert.equal(await prisma.inventory_bottlings.count(),2);
 await patchBrewMetadata(f.userId,f.brewId,{stage:'COMPLETE'});await patchBrewMetadata(f.userId,f.brewId,{stage:'PACKAGED'});
 assert.equal(await balance(out.id),6);assert.equal(await prisma.inventory_bottlings.count(),2);
});

test('quantity history retains the source after packaging output is fully undone',async()=>{
 const f=await fixture(),input=bottlingInput(4);await route('POST',f,input);const out=await productionStock(f,input),source=await production(f,input.client_entry_id);
 const removed=await route('DELETE',f,{bottling:{operation_id:randomUUID(),mode:'sync',expected_revision:source.revision,outputs:[]}},input.client_entry_id);assert.equal(removed.status,200);
 const history=await bottlingMeadService(prisma).history(f.userId,out.mead_id);assert.equal(history.adjustments.length,2);assert.ok(history.adjustments.every(row=>row.source?.entry_id===input.client_entry_id&&row.source.removed));
});

test('reconciling an expired source keeps later uses when production exceeds remaining on-hand bottles',async()=>{
 const f=await fixture(),input=bottlingInput(6);await route('POST',f,input);const meads=bottlingMeadService(prisma);let item=(await meads.overview(f.userId)).meads[0];
 await meads.update(f.userId,item.id,{action:'manual_use',operation_id:randomUUID(),expected_revision:item.revision,size_liters:.75,quantity:4,note:null});
 await prisma.premium_memberships.updateMany({where:{user_id:f.userId},data:{paid_through:new Date('2000-01-01')}});
 const changed={...input.data,bottleRows:input.data.bottleRows.map(row=>({...row,quantity:5}))};await route('PATCH',f,{data:changed},input.client_entry_id);
 await prisma.premium_memberships.updateMany({where:{user_id:f.userId},data:{paid_through:new Date('2100-01-01')}});
 item=(await meads.overview(f.userId)).meads[0];await meads.update(f.userId,item.id,{action:'correction',operation_id:randomUUID(),expected_revision:item.revision,size_liters:.75,quantity:1,note:'Physical count after source correction'});
 const reconcile=productionEdit(input,await production(f,input.client_entry_id),5);reconcile.bottling.mode='reconcile';reconcile.bottling.confirmed_on_hand=true;
 const result=await route('PATCH',f,reconcile,input.client_entry_id);assert.equal(result.status,200,JSON.stringify(result.body));
 const out=await productionStock(f,input);assert.equal(await balance(out.id),1);
 const subsequent=productionEdit(input,await production(f,input.client_entry_id),6);assert.equal((await route('PATCH',f,subsequent,input.client_entry_id)).status,200);assert.equal(await balance(out.id),2);
});

test('retained source snapshots preserve the bottling date and an explicitly cleared note',async()=>{
 const f=await fixture(),input=bottlingInput(3);input.datetime='2026-01-03T00:00:00Z';input.note='Original bottling note';await route('POST',f,input);
 const edit=productionEdit(input,await production(f,input.client_entry_id),3);edit.note=null;
 assert.equal((await route('PATCH',f,edit,input.client_entry_id)).status,200);
 const source=await prisma.inventory_bottlings.findUniqueOrThrow({where:{entry_id:input.client_entry_id}});
 assert.equal(source.source_snapshot.note,null);assert.equal(source.source_snapshot.datetime,'2026-01-03T00:00:00.000Z');assert.equal(await balance((await productionStock(f,input)).id),3);
});

test('entered bottle sizes survive mixed collections, use, receipts and history without display conversion', async () => {
  const userId = await owner();
  const input = { operation_id: randomUUID(), mead: { name: 'Mixed bottle units', bottles: [
    { size_liters: .354882, quantity: 12, display_size: { value: 12, unit: 'fl_oz' } },
    { size_liters: .75, quantity: 4, display_size: { value: 750, unit: 'mL' } },
  ] } };
  const created = await meadRequest('POST', userId, input);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.mead_id;
  const read = async () => (await meadRequest('GET', userId, undefined, id)).body;
  let snapshot = await read();
  const expected = snapshot.mead.bottles.map(row => row.display_size);
  assert.deepEqual(expected, [{ value: 12, unit: 'fl_oz' }, { value: 750, unit: 'mL' }]);
  for (const action of ['manual_use', 'correction', 'receipt']) {
    const result = await meadRequest('PATCH', userId, { action, operation_id: randomUUID(), expected_revision: snapshot.mead.revision,
      size_liters: .354882, quantity: 2, ...(action === "receipt" ? { display_size: { value: .354882, unit: "L" } } : {}) }, id);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    snapshot = await read();
    assert.deepEqual(snapshot.mead.bottles.map(row => row.display_size), expected);
  }
  assert.ok(snapshot.adjustments.filter(row => row.size_liters === .354882)
    .every(row => row.display_size.value === 12 && row.display_size.unit === 'fl_oz'));
  const organization = (await organizationRequest(userId)).body;
  assert.deepEqual(organization.stock.filter(row => row.mead_id === id).map(row => row.display_size)
    .sort((a,b) => a.value-b.value), expected);
  const invalid = structuredClone(input); invalid.operation_id = randomUUID();
  invalid.mead.bottles[0].display_size.value = 750;
  assert.equal((await meadRequest('POST', userId, invalid)).status, 400);
});

test('bottling retains selected US and metric row sizes in private stock and source context', async () => {
  const f = await fixture(), input = bottlingInput(4);
  input.data.bottleRows[0].label = '12oz'; input.data.bottleRows[0].sizeLiters = .355;
  input.data.bottleRows[0].totalLiters = 1.42;
  assert.equal((await route('POST', f, input)).status, 201);
  let stock = await productionStock(f, input);
  assert.equal(stock.bottle_size_value.toNumber(), 12); assert.equal(stock.bottle_size_unit, 'fl_oz');
  let context = await bottlingContext(f.userId, f.brewId);
  assert.deepEqual(context.bottlings[0].outputs[0].display_size, { value: 12, unit: 'fl_oz' });
  const edit = productionEdit(input, context.bottlings[0], 3);
  assert.equal((await route('PATCH', f, edit, input.client_entry_id)).status, 200);
  stock = await productionStock(f, input);
  assert.equal(stock.bottle_size_value.toNumber(), 12); assert.equal(stock.bottle_size_unit, 'fl_oz');
});

const collectionFixture = () => ({ version: 1,
  consumables: [{ key: 'honey', stock: { name: 'Honey', category: 'honey', quantity: kg(2), notes: null, catalogReference: null } }],
  meads: [{ key: 'pie', name: 'Key lime pie', notes: 'Summer', bottles: [
    { key: 'us', size_liters: 0.355, quantity: 6, display_size: { value: 12, unit: 'fl_oz' } },
    { key: 'metric', size_liters: 0.75, quantity: 3, display_size: { value: 750, unit: 'mL' } },
    { key: 'legacy', size_liters: 0.375, quantity: 0 },
  ] }],
  labels: [{ key: 'ready', name: 'Ready' }],
  locations: [{ key: 'box', name: 'Box A', parent_key: 'cellar' }, { key: 'cellar', name: 'Cellar', parent_key: null }],
  assignments: [{ kind: 'mead', key: 'pie', label_key: 'ready' }, { kind: 'stock', key: 'honey', label_key: 'ready' }],
  allocations: [{ stock_key: 'us', location_key: 'box', position: 'A1', quantity: 3 }, { stock_key: 'honey', location_key: 'cellar', position: '', quantity: 1 }],
});
const { createInventoryCollectionService } = await import('../lib/db/inventory-collection.ts');
const collectionService = createInventoryCollectionService(prisma);
const { inspectInventoryFile: inspectCollectionWorkbook } = await import('../lib/brews/inventorySpreadsheet.ts');
const { collectionFromSheets } = await import('@meadtools/inventory-domain');

test('collection import creates mixed units, categories, nested storage and receipts atomically; retries cannot double stock', async () => {
  const userId = await owner();
  const input = { action: 'import_collection', operation_id: randomUUID(), collection: collectionFixture() };
  const result = await transferRequest(userId, input);
  assert.equal(result.status, 200); assert.equal(result.body.created, 2);
  assert.deepEqual((await transferRequest(userId, input)).body, result.body);
  assert.equal(await prisma.inventory_stock.count(), 4);
  assert.equal(await prisma.inventory_adjustments.count(), 3);
  assert.equal(await prisma.inventory_storage_events.count(), 2);
  assert.equal(await prisma.inventory_bottlings.count(), 0);
  const snapshot = await collectionService.snapshot(userId);
  assert.deepEqual(snapshot.meads[0].bottles.map(row => row.display_size ?? null).sort((a,b) => (a?.value ?? 0) - (b?.value ?? 0)), [null, { value:12, unit:'fl_oz' }, { value:750, unit:'mL' }]);
  assert.equal(snapshot.allocations.length, 2);
  const conflict = await transferRequest(userId, { ...input, collection: { ...input.collection, meads: [] } });
  assert.equal(conflict.status, 400); // broken workbook references fail before operation replay
  const changed = structuredClone(input); changed.collection.meads[0].name = 'Changed';
  assert.equal((await transferRequest(userId, changed)).body.code, 'OPERATION_CONFLICT');
});

test('exported collection restores into another account with fresh identities and no foreign brew links', async () => {
  const first = await owner(), second = await owner();
  await collectionService.restore(first, randomUUID(), collectionFixture());
  const exported = await transferRequest(first, { action:'export_collection' });
  assert.equal(exported.status, 200);
  const data = collectionFromSheets(await inspectCollectionWorkbook(exported.body.filename, Buffer.from(exported.body.content,'base64')));
  assert.equal((await transferRequest(second, { action:'import_collection', operation_id:randomUUID(), collection:data })).status, 200);
  const restored = await collectionService.snapshot(second);
  assert.equal(restored.meads[0].name, data.meads[0].name);
  assert.equal(restored.meads[0].bottles.reduce((n,row)=>n+row.quantity,0),9);
  assert.ok(restored.consumables.every(row=>!data.consumables.some(old=>old.key===row.key)));
  assert.equal(restored.labels.length,1); assert.equal(restored.locations.length,2); assert.equal(restored.allocations.length,2);
  const firstStock = data.consumables[0].key;
  assert.equal(await balance(firstStock),2);
  // The same owner's explicit copy also adds fresh stock, while organization is reused.
  await collectionService.restore(first,randomUUID(),data);
  assert.equal(await prisma.inventory_meads.count({where:{user_id:first}}),2);
  assert.equal(await prisma.inventory_labels.count({where:{user_id:first}}),1);
  assert.equal(await prisma.inventory_locations.count({where:{user_id:first}}),2);
});

test('collection import rolls back organization, balances and operation receipt when a later catalog link fails', async () => {
  const userId = await owner(); const data = collectionFixture();
  data.consumables[0].stock.catalogReference = { catalog:'ingredient', id:'2147483647' };
  const result = await transferRequest(userId,{action:'import_collection',operation_id:randomUUID(),collection:data});
  assert.equal(result.status,400);
  for (const table of ['inventory_stock','inventory_meads','inventory_labels','inventory_locations','inventory_allocations','inventory_storage_events','inventory_operations']) assert.equal(await prisma[table].count(),0,table);
});

test('collection export and template remain available after expiry; imports fail and existing consumables exports remain compatible',async()=>{
  const userId=await owner(); await collectionService.restore(userId,randomUUID(),collectionFixture());
  await prisma.premium_memberships.deleteMany({where:{user_id:userId}});
  assert.equal((await transferRequest(userId,{action:'export_collection'})).status,200);
  const template=await transferRequest(userId,{action:'export_collection',template:true});
  assert.equal(template.status,200);
  assert.equal(collectionFromSheets(await inspectCollectionWorkbook(template.body.filename,Buffer.from(template.body.content,'base64'))).meads.length,0);
  assert.equal((await transferRequest(userId,{action:'import_collection',operation_id:randomUUID(),collection:collectionFixture()})).body.code,'PREMIUM_REQUIRED');
  const legacy=await transferRequest(userId,{action:'export',format:'csv'});
  assert.equal(legacy.status,200);
  const sheets=await inspectCollectionWorkbook(legacy.body.filename,Buffer.from(legacy.body.content,'base64'));
  assert.equal(sheets[0].rows.length,2); assert.equal(sheets[0].rows[1][0],'Honey');
});

test('collection invalid allocations and foreign-only references fail before any writes',async()=>{
  const userId=await owner();
  for(const mutate of [data=>{data.allocations[0].quantity=7},data=>{data.allocations[0].quantity=1.5},data=>{data.allocations[0].stock_key=randomUUID()},data=>{data.locations[1].parent_key='box'}]){
    const data=collectionFixture();mutate(data);
    assert.equal((await transferRequest(userId,{action:'import_collection',operation_id:randomUUID(),collection:data})).status,400);
  }
  assert.equal(await prisma.inventory_stock.count(),0);assert.equal(await prisma.inventory_operations.count(),0);
});

test('a full 1000-stock collection import uses bulk writes and produces a complete restorable workbook',async()=>{
  const userId=await owner();const data=collectionFixture();data.meads=[];data.allocations=[];data.assignments=[];
  data.consumables=Array.from({length:1000},(_,index)=>({key:`stock-${index}`,stock:transferStock(`Collection ${index}`,1)}));
  const started=Date.now();const saved=await transferRequest(userId,{action:'import_collection',operation_id:randomUUID(),collection:data});
  assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.created,1000);
  assert.equal(await prisma.inventory_adjustments.count(),1000);
  const exported=await transferRequest(userId,{action:'export_collection'});assert.equal(exported.status,200);
  const restored=collectionFromSheets(await inspectCollectionWorkbook(exported.body.filename,Buffer.from(exported.body.content,'base64')));
  assert.equal(restored.consumables.length,1000);
  console.log(`1000-stock collection import/export completed in ${Date.now()-started}ms`);
});

test('a late collection storage audit failure rolls back every imported object and operation',async()=>{
  const userId=await owner();
  await prisma.$executeRawUnsafe("CREATE FUNCTION fixture_collection_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER fixture_collection_audit_failure BEFORE INSERT ON inventory_storage_events FOR EACH ROW EXECUTE FUNCTION fixture_collection_audit_failure()');
  try{
    const result=await transferRequest(userId,{action:'import_collection',operation_id:randomUUID(),collection:collectionFixture()});
    assert.equal(result.status,500);
    for(const table of ['inventory_stock','inventory_meads','inventory_labels','inventory_label_links','inventory_locations','inventory_allocations','inventory_storage_events','inventory_adjustments','inventory_operations'])assert.equal(await prisma[table].count(),0,table);
  }finally{await prisma.$executeRawUnsafe('DROP TRIGGER fixture_collection_audit_failure ON inventory_storage_events');await prisma.$executeRawUnsafe('DROP FUNCTION fixture_collection_audit_failure()');}
});
