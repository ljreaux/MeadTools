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
test("pantry ingredients use additive stock while honey, yeast and packaging keep their categories", () => {
  const stock = { ...item("sugar", "Brown Sugar"), quantity: { value: 4, unit: "lb" as const } };
  const line = inventoryEntryLines("ADDITION", { kind: "INGREDIENT", name: "Brown Sugar", amount: 1, unit: "lbs" })[0];
  assert.equal(matchInventoryStock([stock], line).stock?.id, stock.id);
  const result = planEntryInventory({ stocks: [stock], lines: [line],
    bindings: [{ line_key: line.key, stock_id: stock.id }], previous: [] });
  assert.equal(result.balances[0].quantity.value, 3);
  for (const restricted of [
    { ...line, name: "Honey" }, { ...line, kind: "YEAST" }, { ...line, kind: "PACKAGING" },
  ]) {
    assert.equal(matchInventoryStock([stock], restricted).choices.length, 0);
    assert.throws(() => planEntryInventory({ stocks: [stock], lines: [restricted],
      bindings: [{ line_key: line.key, stock_id: stock.id }], previous: [] }), /LINK_MISMATCH/);
  }
});
test("fractional yeast packets match count stock and corrections restore previous usage", () => {
  const line = inventoryEntryLines("ADDITION", {
    kind: "YEAST", name: "Lalvin D-47", amount: 0.5, unit: "units",
    meta: { yeastId: 47 },
  })[0];
  const packets = {
    ...item("packets", "D-47 packets"), category: "yeast",
    quantity: { value: 2, unit: "units" as const },
    catalogReference: { catalog: "yeast" as const, id: "47" },
  };
  const grams = { ...packets, id: "grams", quantity: { value: 10, unit: "g" as const } };
  const matched = matchInventoryStock([grams, packets], line);
  assert.deepEqual(matched.choices.map((stock) => stock.id), ["packets"]);
  assert.equal(matched.stock?.id, "packets");
  const bindings = [{ line_key: "addition", stock_id: "packets" }];
  const first = planEntryInventory({ stocks: [packets], lines: [line], bindings, previous: [] });
  assert.deepEqual(first.balances[0].quantity, { value: 1.5, unit: "units" });
  const corrected = planEntryInventory({
    stocks: [{ ...packets, quantity: first.balances[0].quantity }],
    lines: [{ ...line, quantity: { value: 0.25, unit: "units" } }],
    bindings, previous: first.uses,
  });
  assert.deepEqual(corrected.balances[0].quantity, { value: 1.75, unit: "units" });
  const removed = planEntryInventory({
    stocks: [{ ...packets, quantity: corrected.balances[0].quantity }],
    lines: [], bindings: [], previous: corrected.uses,
  });
  assert.deepEqual(removed.balances[0].quantity, packets.quantity);
  assert.throws(() => planEntryInventory({
    stocks: [packets], lines: [{ ...line, quantity: { value: 2.5, unit: "units" } }],
    bindings, previous: [],
  }), /INSUFFICIENT_STOCK/);
  assert.throws(() => planEntryInventory({
    stocks: [grams], lines: [line],
    bindings: [{ line_key: "addition", stock_id: "grams" }], previous: [],
  }), /INCOMPATIBLE_UNITS/);
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

test("bottle suggestions require the physical size while leaving manual choices available", () => {
  const [line] = inventoryEntryLines("PACKAGING", {
    bottleRows: [{ quantity: 4, sizeLiters: 0.75 }],
  });
  const bottle = (id: string, name: string) => ({
    ...item(id, name), category: "packaging",
    quantity: { value: 24, unit: "units" as const },
  });
  const wrong = bottle("wrong", "375 mL bottles");
  const unknown = bottle("unknown", "Wine bottles");
  const right = bottle("right", "0.75 L wine bottles");
  assert.equal(line.sizeLiters, 0.75);
  assert.equal(matchInventoryStock([wrong, unknown, right], line).stock?.id, "right");
  const unmatched = matchInventoryStock([wrong, unknown], line);
  assert.equal(unmatched.stock, undefined);
  assert.equal(unmatched.choices.length, 2);
  for (const name of ["750mL bottles", "0,75 litre bottles", "750 milliliters bottles"]) {
    assert.equal(matchInventoryStock([bottle("right", name)], line).stock?.id, "right", name);
  }
  // Labels are presentation metadata, not the source of physical size.
  const [custom] = inventoryEntryLines("PACKAGING", {
    bottleRows: [{ quantity: 4, sizeLiters: 0.75, label: "375ml" }],
  });
  assert.equal(matchInventoryStock([wrong, right], custom).stock?.id, "right");
});

test("US customary bottle sizes match equivalent volumes without crossing sizes", () => {
  for (const [name, sizeLiters] of [
    ["12 fl oz beer bottles", 0.354882],
    ["12 fl oz beer bottles", 0.355],
    ["22oz bomber bottles", 0.650618],
    ["22oz bomber bottles", 0.65],
    ["1 gallon bottles", 3.785412],
  ] as const) {
    const [line] = inventoryEntryLines("PACKAGING", {
      bottleRows: [{ quantity: 4, sizeLiters }],
    });
    const stock = { ...item("bottle", name), category: "packaging", quantity: { value: 24, unit: "units" as const } };
    assert.equal(matchInventoryStock([stock], line).stock?.id, "bottle", name);
    assert.equal(matchInventoryStock([stock], { ...line, sizeLiters: 0.75 }).stock, undefined);
  }
});

test("closures retain name matching without acquiring a bottle size", () => {
  const [line] = inventoryEntryLines("PACKAGING", {
    closures: [{ name: "26 mm crown caps", quantity: 4 }],
  });
  const stock = { ...item("caps", "26 mm crown caps"), category: "packaging", quantity: { value: 24, unit: "units" as const } };
  assert.equal(line.sizeLiters, undefined);
  assert.equal(matchInventoryStock([stock], line).stock?.id, "caps");
});

test("fractional bottle names cannot suggest their denominator as the capacity", () => {
  const [line] = inventoryEntryLines("PACKAGING", {
    bottleRows: [{ quantity: 4, sizeLiters: 2 }],
  });
  for (const name of ["1/2 L bottles", "1 / 2 L bottles", "1⁄2 L bottles", "1 1/2 L bottles"]) {
    const stock = { ...item("fraction", name), category: "packaging", quantity: { value: 24, unit: "units" as const } };
    const result = matchInventoryStock([stock], line);
    assert.equal(result.stock, undefined, name);
    assert.equal(result.choices.length, 1, name);
  }
});
