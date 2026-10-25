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
const inventoryRoute = await import("../app/api/account/inventory/route.ts");
const inventoryItemRoute = await import("../app/api/account/inventory/[stock_id]/route.ts");
const brewMetadataRoute = await import("../app/api/brews/[brew_id]/route.ts");
const brewInventoryRoute = await import("../app/api/brews/[brew_id]/inventory/route.ts");
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
  assert.equal(await prisma.equipment.count({ where: { user_id: userId } }), 16);
  assert.equal(await prisma.equipment.count({ where: { user_id: otherId } }), 0);
  assert.equal(await prisma.equipment.count({ where: { current_brew_id: { not: null } } }), 2);
  assert.equal(await prisma.equipment.count({ where: { type: "vessel", current_brew_id: null } }), 9);
  assert.equal(await prisma.equipment_assignment_events.count(), 2);
  assert.equal(await prisma.brews.count(), 2);
  assert.equal(await prisma.equipment.count({ where: { current_brew_id: existing.id } }), 1);
  assert.equal(await prisma.inventory_consumptions.count(), 0);
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
  assert.equal(list.length, 19);
  assert.equal(list.filter((row) => row.category === "packaging").length, 4);
  assert.equal((await stockRequest("GET", otherId)).body.stock.length, 0);
  for (const row of list) {
    const history = (await stockRequest("GET", userId, undefined, row.id)).body.adjustments;
    assert.equal(history.length, 1);
    assert.equal(history[0].delta, row.quantity.value);
    assert.equal(history[0].balance_after.unit, row.quantity.unit);
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
  assert.deepEqual((await trackerInventory(f.userId, f.brewId)).body, { can_manage: false, tracked_entry_ids: [], usages: [], vessel_events: [] });
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
