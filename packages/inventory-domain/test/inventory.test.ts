import assert from "node:assert/strict";
import test from "node:test";
import {
  convertQuantity, equipmentInputSchema, InventoryError, matchOwnedStock, normalizeQuantityUnit,
  planConsumption, planStockChange, planVesselAssignment, releaseBrewVessels, resolveInventoryAccess,
  stockInputSchema, quantitySchema,
  type ConsumptionLink, type Quantity, type StockRecord, type VesselAssignment
} from "../src/index";

const stock = (overrides: Partial<StockRecord> = {}): StockRecord => ({
  id: "honey", ownerId: 1,
  catalogReference: { catalog: "ingredient", id: "42" },
  quantity: { value: 5, unit: "kg" }, ...overrides
});
const brew = { id: "brew", ownerId: 1 };
const use = (item: StockRecord, usage: Quantity | null, previous: ConsumptionLink | null = null) =>
  planConsumption({ ownerId: 1, brew, entryId: "entry", stock: item, previous, usage });
const errorCode = (code: InventoryError["code"]) => (error: unknown) =>
  error instanceof InventoryError && error.code === code;

test("normalizes persisted brew/additive unit spellings without guessing unknown units", () => {
  assert.deepEqual(["lbs", "liters", "ml", "quarts", "fl oz", "kg"].map(normalizeQuantityUnit),
    ["lb", "L", "mL", "qt", "fl_oz", "kg"]);
  assert.throws(() => normalizeQuantityUnit("bags"));
});

test("expired/free accounts retain reads without stock writes; inactive accounts have no access", () => {
  assert.deepEqual(resolveInventoryAccess({ activeUser: true, premiumEnabled: true }), {
    canRead: true, canManage: true, usageMode: "inventory_available"
  });
  assert.deepEqual(resolveInventoryAccess({ activeUser: true, premiumEnabled: false }), {
    canRead: true, canManage: false, usageMode: "without_deduction"
  });
  for (const premiumEnabled of [true, false]) {
    assert.deepEqual(resolveInventoryAccess({ activeUser: false, premiumEnabled }), {
      canRead: false, canManage: false, usageMode: "without_deduction"
    });
  }
});

test("converts compatible mass, volume and count using existing core factors", () => {
  for (const [value, unit, target, expected] of [
    [1000, "g", "kg", 1], [1000, "mg", "g", 1],
    [1, "lb", "g", 453.59237], [16, "oz", "lb", 1],
    [1000, "mL", "L", 1], [1, "gal", "L", 3.785412],
    [1, "imp_gal", "L", 4.54609], [3, "tsp", "tbsp", 1],
    [2, "tbsp", "fl_oz", 1], [2, "units", "units", 2]
  ] as const) {
    assert.deepEqual(convertQuantity({ value, unit }, target), { value: expected, unit: target });
  }
});

test("does not infer density, dose size or packet weight", () => {
  for (const [unit, target] of [["kg", "L"], ["g", "tsp"], ["units", "g"]] as const) {
    assert.throws(() => convertQuantity({ value: 1, unit }, target), errorCode("INCOMPATIBLE_UNITS"));
  }
  assert.throws(() => convertQuantity({ value: 0.000001, unit: "mg" }, "kg"),
    errorCode("QUANTITY_PRECISION"));
});

test("shared schemas reject negative, non-finite, excessive and unsupported quantities", () => {
  for (const value of [-1, NaN, Infinity, 1_000_000_001, 0.0000001]) {
    assert.equal(quantitySchema.safeParse({ value, unit: "kg" }).success, false);
  }
  assert.equal(quantitySchema.safeParse({ value: "1", unit: "kg" }).success, false);
  assert.equal(quantitySchema.safeParse({ value: 1, unit: "bags" }).success, false);
  assert.equal(quantitySchema.safeParse({ value: 0, unit: "kg" }).success, true);
  assert.equal(quantitySchema.safeParse({ value: 999_999_999.123456, unit: "kg" }).success, true);
  assert.equal(stockInputSchema.parse({ name: " Honey ", category: "honey",
    quantity: { value: 0, unit: "kg" } }).name, "Honey");
  assert.equal(stockInputSchema.safeParse({ name: " ", category: "honey",
    quantity: { value: 1, unit: "kg" } }).success, false);
  assert.equal(stockInputSchema.safeParse({ name: "Honey", category: "honey",
    quantity: { value: 1, unit: "kg" }, ownerId: 2 }).success, false);
});

test("matching uses owned catalog identity, never names or another user's stock", () => {
  const reference = stock().catalogReference;
  assert.deepEqual(matchOwnedStock(1, reference, [stock()]), { status: "matched", stockId: "honey" });
  assert.deepEqual(matchOwnedStock(1, reference, [stock(), stock({ id: "second" })]),
    { status: "ambiguous", stockIds: ["honey", "second"] });
  assert.deepEqual(matchOwnedStock(1, reference, [stock({ ownerId: 2 })]), { status: "untracked" });
  assert.deepEqual(matchOwnedStock(1, null, [stock()]), { status: "untracked" });
  assert.deepEqual(matchOwnedStock(1, { catalog: "yeast", id: "42" }, [stock()]), { status: "untracked" });
});

test("5 kg -> 4 kg -> retry 4 kg -> corrected 3.5 kg -> removed 5 kg", () => {
  const item = stock();
  const created = use(item, { value: 1000, unit: "g" });
  assert.equal(created.balance.value, 4);
  assert.equal(created.adjustment, -1);
  assert.deepEqual(item.quantity, { value: 5, unit: "kg" });
  const retried = use(stock({ quantity: created.balance }), { value: 1, unit: "kg" }, created.link);
  assert.equal(retried.balance.value, 4);
  assert.equal(retried.adjustment, 0);
  const corrected = use(stock({ quantity: retried.balance }), { value: 1.5, unit: "kg" }, retried.link);
  assert.equal(corrected.balance.value, 3.5);
  assert.equal(corrected.adjustment, -0.5);
  const removed = use(stock({ quantity: corrected.balance }), null, corrected.link);
  assert.equal(removed.balance.value, 5);
  assert.equal(removed.adjustment, 1.5);
  const removedAgain = use(stock({ quantity: removed.balance }), null, removed.link);
  assert.equal(removedAgain.balance.value, 5);
  assert.equal(removedAgain.adjustment, 0);
});

test("correction reverses the recorded rounded deduction, even for converted units", () => {
  let item = stock();
  for (let i = 0; i < 100; i++) {
    const consumed = use(item, { value: 1, unit: "oz" });
    const removed = use({ ...item, quantity: consumed.balance }, null, consumed.link);
    item = { ...item, quantity: removed.balance };
  }
  assert.equal(item.quantity.value, 5);
});

test("insufficient stock reports shortage and leaves inputs unchanged; no partial deduction", () => {
  const item = stock();
  assert.throws(() => use(item, { value: 6, unit: "kg" }), (error: unknown) =>
    errorCode("INSUFFICIENT_STOCK")(error) &&
    (error as InventoryError).details?.shortage === 1);
  assert.equal(item.quantity.value, 5);
  const previous = use(item, { value: 1, unit: "kg" }).link;
  assert.throws(() => use(stock({ quantity: { value: 0, unit: "kg" } }),
    { value: 2, unit: "kg" }, previous), errorCode("INSUFFICIENT_STOCK"));
});

test("ownership and consumption-link identity prevent cross-account and cross-entry corrections", () => {
  assert.throws(() => use(stock({ ownerId: 2 }), { value: 1, unit: "kg" }), errorCode("NOT_FOUND"));
  assert.throws(() => planConsumption({ ownerId: 1, brew: { ...brew, ownerId: 2 },
    entryId: "entry", stock: stock(), previous: null, usage: null }), errorCode("NOT_FOUND"));
  const previous = use(stock(), { value: 1, unit: "kg" }).link!;
  for (const change of [{ stockId: "other" }, { ownerId: 2 }, { brewId: "other" },
    { entryId: "other" }, { deducted: { value: 1, unit: "g" as const } }]) {
    assert.throws(() => use(stock(), null, { ...previous, ...change }), errorCode("LINK_MISMATCH"));
  }
});

test("stock receipts, manual use and absolute corrections share unit and balance rules", () => {
  const change = (kind: "receipt" | "manual_use" | "correction", value: number) =>
    planStockChange({ ownerId: 1, stock: stock(), kind, quantity: { value, unit: "g" } });
  assert.equal(change("receipt", 1000).balance.value, 6);
  assert.equal(change("manual_use", 1000).balance.value, 4);
  assert.deepEqual(change("correction", 2000), { balance: { value: 2, unit: "kg" }, adjustment: -3 });
  assert.throws(() => change("manual_use", 6000), errorCode("INSUFFICIENT_STOCK"));
  assert.throws(() => planStockChange({ ownerId: 2, stock: stock(), kind: "receipt",
    quantity: { value: 1, unit: "kg" } }), errorCode("NOT_FOUND"));
});

test("vessel capacity permits positive volumes, not mass, count, or non-vessel capacity", () => {
  const equipment = { name: "Carboy", type: "vessel", capacity: { value: 5, unit: "gal" } };
  assert.equal(equipmentInputSchema.safeParse(equipment).success, true);
  for (const capacity of [{ value: 0, unit: "L" }, { value: -1, unit: "L" },
    { value: 5, unit: "kg" }, { value: 2, unit: "units" }]) {
    assert.equal(equipmentInputSchema.safeParse({ ...equipment, capacity }).success, false);
  }
  assert.equal(equipmentInputSchema.safeParse({ ...equipment, type: "other" }).success, false);
  assert.equal(equipmentInputSchema.safeParse({ ...equipment, capacity: null }).success, true);
});

test("vessels assign, retry, explicitly reassign, unassign and reject foreign/completed brews", () => {
  const equipment: VesselAssignment = { id: "vessel", ownerId: 1, type: "vessel", brewId: null };
  const target = { ...brew, complete: false };
  const assigned = planVesselAssignment({ ownerId: 1, equipment, brew: target });
  assert.equal(assigned.brewId, brew.id);
  assert.equal(planVesselAssignment({ ownerId: 1, equipment: assigned, brew: target }).brewId, brew.id);
  assert.throws(() => planVesselAssignment({ ownerId: 1, equipment: assigned,
    brew: { ...target, id: "second" } }), errorCode("VESSEL_OCCUPIED"));
  assert.equal(planVesselAssignment({ ownerId: 1, equipment: assigned,
    brew: { ...target, id: "second" }, reassign: true }).brewId, "second");
  assert.equal(planVesselAssignment({ ownerId: 1, equipment: assigned, brew: null }).brewId, null);
  assert.throws(() => planVesselAssignment({ ownerId: 2, equipment, brew: target }), errorCode("NOT_FOUND"));
  assert.throws(() => planVesselAssignment({ ownerId: 1, equipment,
    brew: { ...target, ownerId: 2 } }), errorCode("NOT_FOUND"));
  assert.throws(() => planVesselAssignment({ ownerId: 1, equipment,
    brew: { ...target, complete: true } }), errorCode("BREW_COMPLETE"));
  assert.throws(() => planVesselAssignment({ ownerId: 1,
    equipment: { ...equipment, type: "other" }, brew: target }), errorCode("NOT_A_VESSEL"));
});

test("brew completion/deletion releases only owned occupancy; consumption stays recorded", () => {
  const consumed = use(stock(), { value: 1, unit: "kg" });
  const items: VesselAssignment[] = [
    { id: "one", ownerId: 1, type: "vessel", brewId: brew.id },
    { id: "two", ownerId: 1, type: "vessel", brewId: "other" },
    { id: "foreign", ownerId: 2, type: "vessel", brewId: brew.id }
  ];
  const released = releaseBrewVessels(1, brew.id, items);
  assert.deepEqual(released.map((item) => item.brewId), [null, "other", brew.id]);
  assert.deepEqual(releaseBrewVessels(1, brew.id, released), released);
  assert.equal(items[0].brewId, brew.id);
  assert.equal(consumed.balance.value, 4);
  assert.equal(consumed.link?.deducted.value, 1);
});
