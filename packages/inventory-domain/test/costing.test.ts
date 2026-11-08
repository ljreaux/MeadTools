import assert from "node:assert/strict";
import test from "node:test";
import {
  costLine,
  costPerBottle,
  costPerLiter,
  InventoryCostError,
  matchesCostExclusion,
  planReceiptCost,
  planValuationCost,
  purchasePriceSchema,
  roundMoney,
  summarizeCosts,
  unitCostFromPrice,
  type StockCost,
} from "../src/costing";
import { InventoryError } from "../src/quantity";

const usd = (amount: number, value: number, unit: "kg" | "g" | "lb" | "L" | "units" | "gal") =>
  ({ amount, currency: "USD", per: { value, unit } });
const unknown: StockCost = { unitCost: null, currency: null };
const stock = (unitCost: number | null, unit: "kg" | "g" | "L" | "units" = "kg") => ({
  id: "s1", name: "Clover honey", unit, cost: { unitCost, currency: unitCost === null ? null : "USD" },
});

test("honey costing $30 per 5 kg is $6/kg, and a 1.5 kg line costs $9", () => {
  assert.equal(unitCostFromPrice(usd(30, 5, "kg"), "kg"), 6);
  const line = costLine({ key: "a", name: "Honey", quantity: { value: 1.5, unit: "kg" }, stock: stock(6) });
  assert.equal(line.status, "priced");
  assert.equal(line.cost, 9);
  assert.equal(line.currency, "USD");
});

test("unit costs convert only within a dimension and never invent density or packets", () => {
  assert.equal(unitCostFromPrice(usd(30, 5, "kg"), "g"), 0.006);
  assert.equal(roundMoney(unitCostFromPrice(usd(10, 1, "lb"), "kg"), "USD"), 22.05);
  assert.equal(unitCostFromPrice(usd(4, 1, "gal"), "L"), 1.0566881491);
  assert.throws(() => unitCostFromPrice(usd(30, 5, "kg"), "L"), InventoryError);
  assert.throws(() => unitCostFromPrice(usd(6, 1, "units"), "g"), InventoryError);
  // 1.5 kg used from gram stock, or 300 mL used from kg stock.
  assert.equal(costLine({ key: "a", name: "Honey", quantity: { value: 1.5, unit: "kg" }, stock: stock(0.006, "g") }).cost, 9);
  assert.equal(costLine({ key: "a", name: "Honey", quantity: { value: 300, unit: "mL" }, stock: stock(6) }).status, "incompatible");
});

test("yeast packets are costed as counts, including partial packets", () => {
  const packet = { ...stock(unitCostFromPrice(usd(15, 10, "units"), "units"), "units"), name: "EC-1118" };
  assert.equal(packet.cost.unitCost, 1.5);
  assert.equal(costLine({ key: "y", name: "EC-1118", quantity: { value: 2, unit: "units" }, stock: packet }).cost, 3);
  assert.equal(costLine({ key: "y", name: "EC-1118", quantity: { value: 0.5, unit: "units" }, stock: packet }).cost, 0.75);
  assert.equal(costLine({ key: "y", name: "EC-1118", quantity: { value: 5, unit: "g" }, stock: packet }).status, "incompatible");
});

test("price inputs reject invalid amounts, quantities and currencies", () => {
  for (const price of [
    usd(-1, 1, "kg"), usd(Number.NaN, 1, "kg"), usd(1.00001, 1, "kg"), usd(1, 0, "kg"),
    { amount: 1, currency: "usd", per: { value: 1, unit: "kg" } },
    { amount: 1, currency: "ZZZ", per: { value: 1, unit: "kg" } },
    { amount: 1, currency: "USD", per: { value: 1, unit: "bag" } },
  ]) assert.equal(purchasePriceSchema.safeParse(price).success, false, JSON.stringify(price));
  assert.equal(purchasePriceSchema.safeParse(usd(0, 1, "kg")).success, true);
});

test("priced receipts use a moving weighted average", () => {
  const first = planReceiptCost({ balance: { value: 0, unit: "kg" }, current: unknown,
    receipt: { value: 5, unit: "kg" }, price: usd(30, 5, "kg"), accountCurrency: "USD" });
  assert.deepEqual(first, { cost: { unitCost: 6, currency: "USD" }, appliedUnitCost: 6 });
  // 5 kg at $6 plus 5 kg at $10 per kg averages to $8/kg.
  const second = planReceiptCost({ balance: { value: 5, unit: "kg" }, current: first.cost,
    receipt: { value: 5000, unit: "g" }, price: usd(50, 5, "kg"), accountCurrency: "USD" });
  assert.deepEqual(second.cost, { unitCost: 8, currency: "USD" });
  assert.equal(second.appliedUnitCost, 10);
  // Package price can differ from the received quantity: 2 kg at $30 per 5 kg.
  const package_ = planReceiptCost({ balance: { value: 0, unit: "kg" }, current: unknown,
    receipt: { value: 2, unit: "kg" }, price: usd(30, 5, "kg"), accountCurrency: "USD" });
  assert.equal(package_.cost.unitCost, 6);
});

test("a receipt into empty stock starts a fresh average", () => {
  const plan = planReceiptCost({ balance: { value: 0, unit: "kg" }, current: { unitCost: 6, currency: "USD" },
    receipt: { value: 1, unit: "kg" }, price: usd(12, 1, "kg"), accountCurrency: "USD" });
  assert.deepEqual(plan.cost, { unitCost: 12, currency: "USD" });
});

test("unpriced receipts and unpriced existing stock make the average unknown, never zero", () => {
  const known = { unitCost: 6, currency: "USD" };
  assert.deepEqual(planReceiptCost({ balance: { value: 5, unit: "kg" }, current: known,
    receipt: { value: 1, unit: "kg" }, price: null, accountCurrency: "USD" }).cost, unknown);
  const unpricedBalance = planReceiptCost({ balance: { value: 5, unit: "kg" }, current: unknown,
    receipt: { value: 1, unit: "kg" }, price: usd(6, 1, "kg"), accountCurrency: "USD" });
  assert.deepEqual(unpricedBalance, { cost: unknown, appliedUnitCost: 6 });
  // Explicit valuation fixes it.
  assert.deepEqual(planValuationCost({ stockUnit: "kg", price: usd(36, 6, "kg"), accountCurrency: "USD" }).cost,
    { unitCost: 6, currency: "USD" });
});

test("zero-cost ingredients are priced and keep a complete total", () => {
  const free = planReceiptCost({ balance: { value: 0, unit: "L" }, current: unknown,
    receipt: { value: 20, unit: "L" }, price: usd(0, 20, "L"), accountCurrency: "USD" });
  assert.deepEqual(free.cost, { unitCost: 0, currency: "USD" });
  const summary = summarizeCosts("recorded_usage", [
    costLine({ key: "w", name: "Water", quantity: { value: 10, unit: "L" }, stock: { ...stock(0, "L"), name: "Water" } }),
  ]);
  assert.equal(summary.complete, true);
  assert.deepEqual(summary.totals, [{ currency: "USD", amount: 0 }]);
});

test("prices require the account currency and are never averaged across currencies", () => {
  const base = { balance: { value: 0, unit: "kg" as const }, current: unknown, receipt: { value: 1, unit: "kg" as const } };
  assert.throws(() => planReceiptCost({ ...base, price: usd(6, 1, "kg"), accountCurrency: null }),
    (error: unknown) => error instanceof InventoryCostError && error.code === "CURRENCY_REQUIRED");
  assert.throws(() => planReceiptCost({ ...base, price: { ...usd(6, 1, "kg"), currency: "EUR" }, accountCurrency: "USD" }),
    (error: unknown) => error instanceof InventoryCostError && error.code === "CURRENCY_MISMATCH");
  // After switching the account to EUR, USD-valued stock must be revalued first.
  assert.throws(() => planReceiptCost({ balance: { value: 2, unit: "kg" }, current: { unitCost: 6, currency: "USD" },
    receipt: { value: 1, unit: "kg" }, price: { ...usd(6, 1, "kg"), currency: "EUR" }, accountCurrency: "EUR" }),
    (error: unknown) => error instanceof InventoryCostError && error.code === "CURRENCY_MISMATCH");
});

test("summaries label partial and mixed-currency totals incomplete", () => {
  const lines = [
    costLine({ key: "a", name: "Honey", quantity: { value: 1.5, unit: "kg" }, stock: stock(6) }),
    costLine({ key: "b", name: "Raspberries", quantity: { value: 1, unit: "kg" }, stock: { ...stock(null), id: "s2" } }),
    costLine({ key: "c", name: "Mystery", quantity: { value: 1, unit: "g" }, stock: null }),
    costLine({ key: "d", name: "Spice", quantity: { value: 1, unit: "g" }, stock: null, unmatchedReason: "ambiguous" }),
    costLine({ key: "e", name: "Pinch", quantity: null, stock: null }),
  ];
  const summary = summarizeCosts("recipe_estimate", lines);
  assert.equal(summary.complete, false);
  assert.deepEqual(summary.totals, [{ currency: "USD", amount: 9 }]);
  assert.deepEqual(summary.missing, { unpriced: 1, unmatched: 1, ambiguous: 1, incompatible: 1 });
  const mixed = summarizeCosts("recorded_usage", [
    lines[0],
    costLine({ key: "f", name: "Oak", quantity: { value: 10, unit: "g" },
      stock: { id: "s3", name: "Oak", unit: "g", cost: { unitCost: 0.1, currency: "EUR" } } }),
  ]);
  assert.equal(mixed.mixedCurrencies, true);
  assert.equal(mixed.complete, false);
  assert.deepEqual(mixed.totals, [{ currency: "EUR", amount: 1 }, { currency: "USD", amount: 9 }]);
});

test("an empty summary is never reported complete", () => {
  const summary = summarizeCosts("recorded_usage", []);
  assert.equal(summary.complete, false);
  assert.deepEqual(summary.totals, []);
});

test("rounding is deterministic: lines keep micro-units and display uses currency digits", () => {
  const third = costLine({ key: "a", name: "Honey", quantity: { value: 1, unit: "kg" },
    stock: stock(unitCostFromPrice(usd(10, 3, "kg"), "kg")) });
  assert.equal(third.cost, 3.333333);
  const summary = summarizeCosts("recorded_usage", [third, { ...third, key: "b" }, { ...third, key: "c" }]);
  assert.equal(summary.totals[0].amount, 9.999999);
  assert.equal(roundMoney(summary.totals[0].amount, "USD"), 10);
  assert.equal(roundMoney(1234.5, "JPY"), 1235);
});

test("per-liter and per-bottle values are estimates from known volume only", () => {
  assert.equal(costPerLiter(45, 18.9271), 2.377543);
  assert.equal(costPerLiter(45, 0), null);
  assert.equal(costPerLiter(45, null), null);
  assert.deepEqual(costPerBottle(30, [{ sizeLiters: 0.75, count: 20 }, { sizeLiters: 0.375, count: 0 }]),
    [{ sizeLiters: 0.75, count: 20, amount: 1.5 }]);
  assert.deepEqual(costPerBottle(30, [{ sizeLiters: 0.75, count: 10 }, { sizeLiters: 0.375, count: 20 }]),
    [{ sizeLiters: 0.75, count: 10, amount: 1.5 }, { sizeLiters: 0.375, count: 20, amount: 0.75 }]);
  assert.equal(costPerBottle(30, []), null);
});

test("excluded ingredients stop missing-cost warnings without hiding known prices", () => {
  const water = { name: "Water", catalogReference: null };
  const lines = [
    costLine({ key: "h", name: "Honey", quantity: { value: 1.5, unit: "kg" }, stock: stock(6) }),
    costLine({ key: "w", name: "Water", quantity: { value: 10, unit: "L" }, stock: null,
      excluded: matchesCostExclusion({ name: "water" }, [water]) }),
  ];
  const summary = summarizeCosts("recipe_estimate", lines);
  assert.equal(lines[1].status, "excluded");
  assert.equal(summary.complete, true);
  assert.equal(summary.excludedLines, 1);
  assert.deepEqual(summary.missing, { unpriced: 0, unmatched: 0, ambiguous: 0, incompatible: 0 });
  assert.deepEqual(summary.totals, [{ currency: "USD", amount: 9 }]);
});

test("an exclusion wins over a known price, including recorded snapshots", () => {
  // Reused bottles: a priced, snapshotted use excluded afterward for one brew.
  const bottles = { id: "b", name: "12 fl oz beer bottles", unit: "units" as const, cost: { unitCost: 0.75, currency: "USD" } };
  const recorded = [
    costLine({ key: "h", name: "Honey", quantity: { value: 1.5, unit: "kg" }, stock: stock(6) }),
    costLine({ key: "b", name: "12 fl oz bottles", quantity: { value: 56, unit: "units" }, stock: bottles }),
  ];
  assert.deepEqual(summarizeCosts("recorded_usage", recorded).totals, [{ currency: "USD", amount: 51 }]);
  const excluded = [recorded[0], costLine({ key: "b", name: "12 fl oz bottles", quantity: { value: 56, unit: "units" },
    stock: bottles, excluded: true })];
  const summary = summarizeCosts("recorded_usage", excluded);
  assert.equal(excluded[1].status, "excluded");
  assert.equal(excluded[1].cost, null);
  assert.equal(summary.complete, true);
  assert.equal(summary.excludedLines, 1);
  assert.deepEqual(summary.totals, [{ currency: "USD", amount: 9 }]);
});

test("exclusions match by catalog identity or exact normalized name only", () => {
  const byCatalog = [{ name: "Spring water", catalogReference: { catalog: "ingredient" as const, id: "9" } }];
  assert.equal(matchesCostExclusion({ name: "Water", catalogReference: { catalog: "ingredient", id: "9" } }, byCatalog), true);
  assert.equal(matchesCostExclusion({ name: "Water", catalogReference: { catalog: "yeast", id: "9" } }, byCatalog), false);
  assert.equal(matchesCostExclusion({ name: "  SPRING-water " }, byCatalog), true);
  assert.equal(matchesCostExclusion({ name: "Water" }, [{ name: "Water", catalogReference: null }]), true);
  assert.equal(matchesCostExclusion({ name: "Watermelon" }, [{ name: "Water", catalogReference: null }]), false);
  assert.equal(matchesCostExclusion({ name: "" }, [{ name: "", catalogReference: null }]), false);
});
