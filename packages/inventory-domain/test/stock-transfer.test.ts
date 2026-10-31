import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTransferRow,
  resolveTransferStockIdentity,
  suggestTransferMapping,
  parseTransferNumber,
  stockTransferImportSchema,
  safeCsvCell,
  suggestTransferCatalog,
  nutrientCatalog,
  stabilizerCatalog,
} from "../src/index";
const mapping = { name: 0, category: 1, quantity: 2, unit: 3, notes: 4 };
test("headers use names, avoid ambiguous duplicates and do not treat generic IDs as stock IDs", () => {
  assert.deepEqual(
    suggestTransferMapping(["Unit", "Product name", "Qty", "Type", "ID"]),
    { name: 1, category: 3, quantity: 2, unit: 0 },
  );
  assert.equal(suggestTransferMapping(["Name", "name"]).name, undefined);
  assert.equal(suggestTransferMapping(["SKU", "ID"]).stock_id, undefined);
});
test("locale number parsing distinguishes separators, missing values and zero", () => {
  assert.equal(parseTransferNumber("1,234.56", "."), 1234.56);
  assert.equal(parseTransferNumber("1.234,56", ","), 1234.56);
  assert.equal(parseTransferNumber("0", "."), 0);
  for (const value of [
    "",
    "1,23.4",
    "1.234,56",
    "Infinity",
    "=1+1",
    "0x12",
    "1 000",
  ])
    assert.throws(() => parseTransferNumber(value, "."));
});
test("normalization supports source units, defaults, named extra notes and combined amounts", () => {
  const result = normalizeTransferRow(
    [" My jar ", "nutrient", "10", "grams", "line 1\nline 2", "A-42"],
    mapping,
    ".",
    [5],
    {},
    ["Name", "Category", "Qty", "Unit", "Notes", "SKU"],
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.stock?.notes, "line 1\nline 2\nSKU: A-42");
  assert.equal(result.stock?.quantity.unit, "g");
  assert.equal(result.stock?.category, "additive");
  assert.equal(result.stock?.name, "My jar");
  assert.deepEqual(
    normalizeTransferRow(
      ["Bottles", "", "24 units"],
      { name: 0, category: 1, quantity: 2 },
      ".",
      [],
      { category: "packaging" },
    ).stock?.quantity,
    { value: 24, unit: "units" },
  );
});
test("precision, packaging, blank and negative amounts fail explicitly; partial tablets are valid counts", () => {
  for (const cells of [
    ["Bottles", "packaging", "1.5", "units"],
    ["Honey", "honey", "-1", "kg"],
    ["Honey", "honey", "0.0000001", "kg"],
    ["Honey", "fermentable", "1", "kg"],
    ["Honey", "honey", "", "kg"],
  ])
    assert.ok(normalizeTransferRow(cells, mapping, ".").errors.length);
  assert.deepEqual(
    normalizeTransferRow(
      ["Campden", "additive", "0.5", "tablets"],
      mapping,
      ".",
    ).stock?.quantity,
    { value: 0.5, unit: "units" },
  );
});
test("catalog matching honors exact products, category and ambiguity", () => {
  const catalog = [
    ...nutrientCatalog.map((item) => ({
      name: item.name,
      ref: { catalog: "nutrient" as const, id: item.id },
    })),
    ...stabilizerCatalog.map((item) => ({
      name: item.name,
      ref: { catalog: "additive" as const, id: item.id },
    })),
  ];
  assert.equal(
    suggestTransferCatalog("Potassium sorbate", "additive", catalog).reference
      ?.id,
    "potassiumSorbate",
  );
  assert.equal(
    suggestTransferCatalog("Go-Ferm Sterol Flash", "additive", catalog)
      .reference?.id,
    "goFermSterolFlash",
  );
  assert.equal(
    suggestTransferCatalog("Fermaid O", "yeast", catalog).reference,
    null,
  );
  assert.equal(
    suggestTransferCatalog("Fermaid O", "additive", [...catalog, catalog[0]])
      .reference,
    null,
  );
});
test("CSV text is quoted and formula-like prefixes are neutralized", () => {
  assert.equal(safeCsvCell("=1+1"), '"\'=1+1"');
  assert.equal(safeCsvCell("'name"), "\"''name\"");
  assert.equal(safeCsvCell('a,"b"'), '"a,""b"""');
});
test("the import request rejects repeated identities and overlarge selections", () => {
  const row = {
    row_number: 2,
    stock: {
      name: "Honey",
      category: "honey",
      quantity: { value: 1, unit: "kg" },
    },
  };
  const input = {
    action: "import",
    mode: "create",
    operation_id: "8cabf4e2-3e98-4d38-bc92-710ee044c6f7",
    rows: [row],
  };
  assert.ok(stockTransferImportSchema.safeParse(input).success);
  assert.ok(
    !stockTransferImportSchema.safeParse({ ...input, rows: [row, row] })
      .success,
  );
  assert.ok(
    !stockTransferImportSchema.safeParse({
      ...input,
      rows: Array.from({ length: 1001 }, (_, i) => ({
        ...row,
        row_number: i + 1,
      })),
    }).success,
  );
});

test("restoring an export creates new stock without stale IDs; only owned existing rows default to excluded", () => {
  const deletedId = "d5d011c0-21b6-40f1-993f-1395b5654a33";
  const ownedId = "c5d011c0-21b6-40f1-993f-1395b5654a33";
  const owned = new Map([[ownedId, {}]]);
  assert.deepEqual(resolveTransferStockIdentity("create", deletedId, owned), {
    skipByDefault: false,
    stockId: undefined,
  });
  assert.deepEqual(resolveTransferStockIdentity("create", ownedId, owned), {
    skipByDefault: true,
    stockId: undefined,
  });
  assert.deepEqual(resolveTransferStockIdentity("update", ownedId, owned), {
    skipByDefault: false,
    stockId: ownedId,
  });
  // Unknown update IDs stay present for ownership validation, never silently create.
  assert.equal(
    resolveTransferStockIdentity("update", deletedId, owned).stockId,
    deletedId,
  );
  const normalized = normalizeTransferRow(
    ["Honey", "honey", "2", "kg", deletedId],
    { name: 0, category: 1, quantity: 2, unit: 3, stock_id: 4 },
    ".",
  );
  const identity = resolveTransferStockIdentity(
    "create",
    normalized.stockId,
    new Map(),
  );
  assert.equal(identity.skipByDefault, false);
  assert.equal(
    stockTransferImportSchema.safeParse({
      action: "import",
      operation_id: ownedId,
      mode: "create",
      rows: [
        {
          row_number: 2,
          stock: normalized.stock,
          ...(identity.stockId ? { stock_id: identity.stockId } : {}),
        },
      ],
    }).success,
    true,
  );
});
