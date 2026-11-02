import Fuse from "fuse.js";
import { z } from "zod";
import { stockInputSchema, catalogReferenceSchema } from "./schemas";
import { normalizeQuantityUnit, quantityUnitSchema } from "./quantity";

export const IMPORT_ROW_LIMIT = 1000;
export const SHEET_ROW_LIMIT = 1101;
export const SHEET_COLUMN_LIMIT = 50;
export const FILE_BYTE_LIMIT = 5 * 1024 * 1024;
export const stockTransferRowSchema = z
  .object({
    row_number: z.number().int().min(1).max(SHEET_ROW_LIMIT),
    stock: stockInputSchema,
    stock_id: z.string().uuid().optional(),
    expected: stockInputSchema.optional(),
  })
  .strict();
export const stockTransferImportSchema = z
  .object({
    action: z.literal("import"),
    operation_id: z.string().uuid(),
    mode: z.enum(["create", "update"]),
    rows: z.array(stockTransferRowSchema).min(1).max(IMPORT_ROW_LIMIT),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.rows.map((row) => row.row_number)).size ===
      value.rows.length,
    { message: "Duplicate row numbers" },
  )
  .refine(
    (value) => {
      const ids = value.rows.flatMap((row) =>
        row.stock_id ? [row.stock_id] : [],
      );
      return new Set(ids).size === ids.length;
    },
    { message: "Duplicate stock IDs" },
  );
// Exported IDs identify updates only within the current account's inventory.
// A restored workbook creates fresh records rather than reusing deleted IDs.
export function resolveTransferStockIdentity(
  mode: "create" | "update",
  stockId: string | undefined,
  ownedIds: ReadonlyMap<string, unknown>,
) {
  return {
    skipByDefault:
      mode === "create" && Boolean(stockId && ownedIds.has(stockId)),
    stockId: mode === "update" ? stockId : undefined,
  };
}

export const transferFields = [
  "name",
  "category",
  "quantity",
  "unit",
  "notes",
  "catalog_type",
  "catalog_id",
  "catalog_name",
  "stock_id",
] as const;
export type TransferField = (typeof transferFields)[number];
export type TransferMapping = Partial<Record<TransferField, number>>;
export const transferHeaders = [
  "Name",
  "Category",
  "Quantity",
  "Unit",
  "Notes",
  "Catalog type",
  "Catalog ID",
  "Catalog name",
  "MeadTools stock ID",
];
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const aliases: Record<TransferField, string[]> = {
  name: ["name", "item", "item name", "ingredient", "product", "product name"],
  category: ["category", "type", "ingredient type"],
  quantity: [
    "quantity",
    "amount",
    "stock",
    "on hand",
    "balance",
    "qty",
    "quantity remaining",
  ],
  unit: ["unit", "units", "uom", "measure", "measurement unit"],
  notes: ["notes", "note", "description"],
  catalog_type: ["catalog type", "catalog namespace"],
  catalog_id: ["catalog id"],
  catalog_name: ["catalog name"],
  stock_id: ["meadtools stock id"],
};
export function suggestTransferMapping(
  headers: readonly string[],
): TransferMapping {
  const result: TransferMapping = {};
  for (const field of transferFields) {
    const found = headers.flatMap((header, index) =>
      aliases[field].includes(normalize(header)) ? [index] : [],
    );
    if (found.length === 1) result[field] = found[0];
  }
  return result;
}
const categoryAliases: Record<string, string> = {
  honey: "honey",
  honeys: "honey",
  fruit: "fruit",
  fruits: "fruit",
  juice: "fruit",
  yeast: "yeast",
  yeasts: "yeast",
  additive: "additive",
  additives: "additive",
  nutrient: "additive",
  nutrients: "additive",
  stabilizer: "additive",
  stabilizers: "additive",
  packaging: "packaging",
  bottle: "packaging",
  bottles: "packaging",
  corks: "packaging",
  caps: "packaging",
};
const unitAliases: Record<string, string> = {
  kilogram: "kg",
  kilograms: "kg",
  gram: "g",
  grams: "g",
  milligram: "mg",
  milligrams: "mg",
  pound: "lb",
  pounds: "lb",
  lbs: "lb",
  ounce: "oz",
  ounces: "oz",
  l: "L",
  litre: "L",
  litres: "L",
  liter: "L",
  liters: "L",
  ml: "mL",
  milliliter: "mL",
  milliliters: "mL",
  millilitre: "mL",
  millilitres: "mL",
  gallon: "gal",
  gallons: "gal",
  each: "units",
  ea: "units",
  count: "units",
  bottles: "units",
  tablet: "units",
  tablets: "units",
  unit: "units",
  pieces: "units",
};
export function parseTransferNumber(text: string, decimal: "." | ","): number {
  const value = text.trim();
  const pattern =
    decimal === "."
      ? /^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/
      : /^[+-]?(?:(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?|,\d+)$/;
  if (!pattern.test(value)) throw new Error("quantity");
  return Number(
    decimal === "."
      ? value.replace(/,/g, "")
      : value.replace(/\./g, "").replace(",", "."),
  );
}
export function normalizeTransferRow(
  cells: readonly string[],
  mapping: TransferMapping,
  decimal: "." | ",",
  extraNotes: readonly number[] = [],
  defaults: { category?: string; unit?: string } = {},
  headers: readonly string[] = [],
) {
  const value = (field: TransferField) =>
    mapping[field] === undefined ? "" : (cells[mapping[field]!] ?? "").trim();
  const errors: string[] = [];
  let quantity = NaN;
  let unit: ReturnType<typeof normalizeQuantityUnit> | undefined;
  let amountText = value("quantity");
  let unitText = value("unit") || defaults.unit || "";
  if (!unitText) {
    const combined = amountText.match(/^(.+?)\s*([A-Za-z_][A-Za-z_ ]*)$/);
    if (combined) {
      amountText = combined[1].trim();
      unitText = combined[2].trim();
    }
  }
  try {
    quantity = parseTransferNumber(amountText, decimal);
  } catch {
    errors.push("quantity");
  }
  try {
    unit = normalizeQuantityUnit(
      unitAliases[unitText.toLowerCase()] ??
        quantityUnitSchema.options.find(
          (unit) => unit.toLowerCase() === unitText.toLowerCase(),
        ) ??
        unitText,
    );
  } catch {
    errors.push("unit");
  }
  const rawCategory = value("category") || defaults.category || "";
  const category = categoryAliases[normalize(rawCategory)] ?? rawCategory;
  const type = value("catalog_type"),
    id = value("catalog_id");
  let reference: null | z.infer<typeof catalogReferenceSchema> = null;
  if (type || id) {
    const result = catalogReferenceSchema.safeParse({
      catalog: type.toLowerCase(),
      id,
    });
    if (result.success) reference = result.data;
    else errors.push("catalog");
  }
  const notes = [
    mapping.notes === undefined ? "" : (cells[mapping.notes] ?? ""),
    ...extraNotes
      .map((index) =>
        cells[index]?.trim()
          ? `${headers[index] ?? index + 1}: ${cells[index]}`
          : "",
      )
      .filter(Boolean),
  ]
    .filter(Boolean)
    .join("\n");
  const stock = stockInputSchema.safeParse({
    name: value("name"),
    category,
    quantity: { value: quantity, unit },
    catalogReference: reference,
    notes: notes || null,
  });
  if (!stock.success)
    for (const issue of stock.error.issues)
      errors.push(String(issue.path[0] ?? "row"));
  const stockId = value("stock_id");
  if (stockId && !z.string().uuid().safeParse(stockId).success)
    errors.push("stock_id");
  return {
    stock: stock.success ? stock.data : null,
    stockId: stockId || undefined,
    sourceName: value("name"),
    catalogName: value("catalog_name"),
    errors: Array.from(new Set(errors)),
  };
}
/** CSV formula protection is reversible for MeadTools' own canonical round trips. */
export function safeCsvCell(value: string): string {
  const text =
    /^[\s]*[=+\-@\t\r]/.test(value) || value.startsWith("'")
      ? "'" + value
      : value;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function suggestTransferCatalog(
  name: string,
  category: string,
  catalog: readonly {
    name: string;
    ref: z.infer<typeof catalogReferenceSchema>;
  }[],
) {
  const candidates = catalog.filter((item) =>
    category === "yeast"
      ? item.ref.catalog === "yeast"
      : category === "additive"
        ? ["additive", "nutrient"].includes(item.ref.catalog)
        : ["honey", "fruit"].includes(category) &&
          item.ref.catalog === "ingredient",
  );
  const exact = candidates.filter(
    (item) => normalize(item.name) === normalize(name),
  );
  if (exact.length)
    return {
      reference: exact.length === 1 ? exact[0].ref : null,
      warning: exact.length > 1,
    };
  const result = new Fuse(
    candidates.map((item) => ({ ...item, searchName: normalize(item.name) })),
    {
      keys: ["searchName"],
      includeScore: true,
      ignoreLocation: true,
      ignoreFieldNorm: true,
      threshold: 0.35,
    },
  ).search(normalize(name));
  return result[0]
    ? {
        reference:
          (result[1]?.score ?? 1) - (result[0].score ?? 1) < 0.06
            ? null
            : result[0].item.ref,
        warning: true,
      }
    : { reference: null, warning: false };
}
