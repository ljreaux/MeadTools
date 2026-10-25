import assert from "node:assert/strict";
import test from "node:test";
import {
  inventoryEntryLines,
  matchInventoryStock,
  planEntryInventory,
  resolveCatalogReferences,
} from "../src/index";
const nutrient = (key = "fermO", name = "Nutrient addition 1") =>
  inventoryEntryLines("ADDITION", {
    kind: "NUTRIENT",
    name,
    meta: {
      components: [
        {
          key,
          name: key === "fermO" ? "Fermaid O" : "Fermaid K",
          amount: 2,
          unit: "g",
        },
      ],
    },
  })[0];
const item = (
  id: string,
  name: string,
  reference?: { catalog: "nutrient"; id: string },
) => ({
  id,
  name,
  category: "additive",
  quantity: { value: 10, unit: "g" as const },
  catalogReference: reference ?? null,
  reconciliation_required: false,
});
test("nutrients match components and use stable nutrient IDs", () => {
  const line = nutrient();
  assert.equal(line.name, "Fermaid O");
  assert.deepEqual(line.catalogReference, { catalog: "nutrient", id: "fermO" });
  assert.equal(
    matchInventoryStock(
      [
        item("o", "My nutrient", { catalog: "nutrient", id: "fermO" }),
        item("k", "Fermaid O", { catalog: "nutrient", id: "fermK" }),
      ],
      line,
    ).stock?.id,
    "o",
  );
});
test("multiple linked lots require an explicit choice", () => {
  const match = matchInventoryStock(
    [
      item("a", "A", { catalog: "nutrient", id: "fermO" }),
      item("b", "B", { catalog: "nutrient", id: "fermO" }),
    ],
    nutrient(),
  );
  assert.equal(match.stock, undefined);
  assert.equal(match.warning, "linked_ambiguous");
});
test("Fuse is a fallback for unlinked stock and warns on ties", () => {
  const result = matchInventoryStock(
    [item("b", "Fermaid O"), item("a", "Fermaid O")],
    nutrient(),
  );
  assert.equal(result.stock?.id, "a");
  assert.equal(result.warning, "ambiguous");
  assert.equal(
    matchInventoryStock(
      [item("k", "Fermaid O", { catalog: "nutrient", id: "fermK" })],
      nutrient(),
    ).stock,
    undefined,
  );
});
test("Fuse handles typos without crossing category or unit dimensions", () => {
  const stock = item("a", "Fermaid O");
  assert.equal(
    matchInventoryStock([stock], {
      ...nutrient(),
      name: "Fermiad O",
      catalogReference: null,
    }).stock?.id,
    "a",
  );
  assert.equal(
    matchInventoryStock([{ ...stock, category: "yeast" }], nutrient()).stock,
    undefined,
  );
  assert.equal(
    matchInventoryStock([stock], {
      ...nutrient(),
      quantity: { value: 2, unit: "mL" },
    }).stock,
    undefined,
  );
});
test("legacy catalog identity is exact and unique, never fuzzy", () => {
  const records = [
    {
      name: "Fermaid O",
      reference: { catalog: "nutrient" as const, id: "fermO" },
    },
  ];
  assert.equal(
    resolveCatalogReferences(
      [{ name: "fermaid o", kind: "NUTRIENT" }],
      records,
    )[0].catalogReference?.id,
    "fermO",
  );
  assert.equal(
    resolveCatalogReferences(
      [{ name: "Fermiad O", kind: "NUTRIENT" }],
      records,
    )[0].catalogReference,
    undefined,
  );
});
test("multi-line planning combines stock use and returns all old deductions", () => {
  const lines = [
    nutrient(),
    {
      ...nutrient(),
      key: "component:other",
      quantity: { value: 3, unit: "g" as const },
    },
  ];
  const stocks = [item("a", "Nutrients")];
  const bindings = lines.map((line) => ({ line_key: line.key, stock_id: "a" }));
  assert.equal(
    planEntryInventory({ stocks, lines, bindings, previous: [] }).balances[0]
      .quantity.value,
    5,
  );
  assert.equal(
    planEntryInventory({
      stocks,
      lines,
      bindings,
      previous: [
        { line_key: "old", stock_id: "a", deducted: { value: 1, unit: "g" } },
      ],
    }).balances[0].quantity.value,
    6,
  );
  assert.throws(
    () =>
      planEntryInventory({
        stocks: [{ ...stocks[0], quantity: { value: 4, unit: "g" } }],
        lines,
        bindings,
        previous: [],
      }),
    { code: "INSUFFICIENT_STOCK" },
  );
});
test("packaging deducts explicit counts only and validates whole units", () => {
  const lines = inventoryEntryLines("PACKAGING", {
    bottleRows: [{ quantity: 4, sizeLiters: 0.75 }],
    closures: [{ name: "Corks", quantity: 4 }],
  });
  assert.deepEqual(
    lines.map((line) => [line.name, line.quantity.value]),
    [
      ["750 mL bottles", 4],
      ["Corks", 4],
    ],
  );
  assert.deepEqual(
    inventoryEntryLines("PACKAGING", { packagedVolumeLiters: 5 }),
    [],
  );
  assert.throws(() =>
    inventoryEntryLines("PACKAGING", {
      bottleRows: [{ quantity: 1.5, sizeLiters: 0.75 }],
    }),
  );
});

test("stabilizer identities distinguish chemistry and tablet form", () => {
  const make = (
    stabilizerKind: string,
    stabilizerType: string,
    sulfiteForm: string,
    unit = "g",
  ) =>
    inventoryEntryLines("ADDITION", {
      kind: "OTHER",
      name: "Translated stabilizer",
      amount: 0.5,
      unit,
      meta: { stabilizerKind, stabilizerType, sulfiteForm },
    })[0];
  assert.equal(
    make("sorbate", "kmeta", "powder").catalogReference?.id,
    "potassiumSorbate",
  );
  assert.equal(
    make("sulfite", "kmeta", "powder").catalogReference?.id,
    "potassiumMetabisulfite",
  );
  assert.equal(
    make("sulfite", "nameta", "powder").catalogReference?.id,
    "sodiumMetabisulfite",
  );
  const tablets = make("sulfite", "kmeta", "campden", "tablets");
  assert.equal(tablets.catalogReference?.id, "campdenPotassium");
  assert.deepEqual(tablets.quantity, { value: 0.5, unit: "units" });
  assert.equal(
    make("sulfite", "nameta", "campden", "tablets").catalogReference?.id,
    "campdenSodium",
  );
  const wrong = {
    ...item("wrong", "Campden tablets"),
    catalogReference: { catalog: "additive" as const, id: "campdenSodium" },
    quantity: { value: 10, unit: "units" as const },
  };
  assert.equal(matchInventoryStock([wrong], tablets).stock, undefined);
  assert.equal(
    matchInventoryStock(
      [
        {
          ...wrong,
          catalogReference: null,
          quantity: { value: 10, unit: "g" as const },
        },
      ],
      tablets,
    ).stock,
    undefined,
  );
});

test("recognized but unlinked chemicals cannot become a conflicting fuzzy default", () => {
  const line = inventoryEntryLines("ADDITION", {
    name: "Potassium sorbate",
    kind: "OTHER",
    amount: 2,
    unit: "g",
    meta: { stabilizerKind: "sorbate" },
  })[0];
  const sulfite = item("a", "Potassium metabisulfite");
  assert.equal(matchInventoryStock([sulfite], line).stock, undefined);
  assert.equal(matchInventoryStock([sulfite], line).choices.length, 1);
  assert.equal(
    matchInventoryStock([item("k", "Fermaid K")], nutrient()).stock,
    undefined,
  );
});
test("all Go-Ferm variants match their built-in identities without database additive IDs", () => {
  for (const [id, name] of [
    ["goFerm", "Go-Ferm"],
    ["goFermProtect", "Go-Ferm Protect"],
    ["goFermSterolFlash", "Go-Ferm Sterol Flash"],
  ]) {
    const line = inventoryEntryLines("ADDITION", {
      name: "Rehydration nutrient",
      kind: "NUTRIENT",
      amount: 12,
      unit: "g",
      meta: { nutrientKey: id },
    })[0];
    assert.deepEqual(line.catalogReference, { catalog: "nutrient", id });
    const stock = ["goFerm", "goFermProtect", "goFermSterolFlash"].map(
      (key, index) =>
        item(String(index), "My nutrient", { catalog: "nutrient", id: key }),
    );
    assert.equal(
      matchInventoryStock(stock, line).stock?.catalogReference?.id,
      id,
    );
    assert.equal(
      matchInventoryStock([item("legacy", name)], line).stock?.id,
      "legacy",
    );
  }
});
