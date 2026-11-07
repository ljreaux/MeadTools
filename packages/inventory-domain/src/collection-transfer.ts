import { z } from "zod";
import { stockInputSchema, validateStockQuantity } from "./schemas";
import { bottleDisplaySizeSchema, finishedMeadBottleInputSchema, finishedMeadDetailsSchema } from "./finished-mead";
import { convertQuantity, quantityValueSchema } from "./quantity";
import { validateAllocationTotal } from "./organization";

const key = z.string().trim().min(1).max(100);
const name = z.string().trim().min(1).max(100);
const keyedBottle = finishedMeadBottleInputSchema.safeExtend({ key });
/** Portable keys are workbook references, never permission to update a database ID. */
export const inventoryCollectionSchema = z.object({
  version: z.literal(1),
  consumables: z.array(z.object({ key, stock: stockInputSchema }).strict()).max(1000),
  meads: z.array(finishedMeadDetailsSchema.extend({ key, bottles: z.array(keyedBottle).min(1).max(50) }).strict()).max(1000),
  labels: z.array(z.object({ key, name }).strict()).max(1000),
  locations: z.array(z.object({ key, name, parent_key: key.nullable() }).strict()).max(1000),
  assignments: z.array(z.object({ kind: z.enum(["stock", "mead"]), key, label_key: key }).strict()).max(1000),
  allocations: z.array(z.object({ stock_key: key, location_key: key, position: z.string().trim().max(200), quantity: quantityValueSchema.positive() }).strict()).max(1000),
}).strict().superRefine((data, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  const unique = (values: string[], label: string) => { if (new Set(values).size !== values.length) fail(`Duplicate ${label}`); };
  const stocks = new Map(data.consumables.map(row => [row.key, { category: row.stock.category as string, quantity: row.stock.quantity }]));
  for (const mead of data.meads) {
    unique(mead.bottles.map(row => String(row.size_liters)), "bottle capacities");
    for (const bottle of mead.bottles) stocks.set(bottle.key, { category: "packaging", quantity: { value: bottle.quantity, unit: "units" } });
  }
  const stockKeys = [...data.consumables.map(row => row.key), ...data.meads.flatMap(row => row.bottles.map(bottle => bottle.key))];
  if (stockKeys.length > 1000) fail("At most 1000 stock rows may be imported");
  unique(stockKeys, "stock keys");
  unique(data.meads.map(row => row.key), "mead keys");
  unique(data.labels.map(row => row.key), "category keys");
  unique(data.locations.map(row => row.key), "location keys");
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase();
  unique(data.labels.map(row => normalize(row.name)), "category names");
  unique(data.locations.map(row => JSON.stringify([row.parent_key, normalize(row.name)])), "sibling locations");
  const locations = new Map(data.locations.map(row => [row.key, row]));
  for (const location of data.locations) {
    const seen = new Set<string>();
    let current: typeof location | undefined = location;
    let length = 0;
    while (current) {
      if (seen.has(current.key)) { fail("Cyclic storage hierarchy"); break; }
      seen.add(current.key); length += current.name.length + 3;
      if (length > 5003) { fail("Storage path is too long"); break; }
      if (current.parent_key && !locations.has(current.parent_key)) { fail("Unknown parent location"); break; }
      current = current.parent_key ? locations.get(current.parent_key) : undefined;
    }
  }
  const labels = new Set(data.labels.map(row => row.key));
  const meads = new Set(data.meads.map(row => row.key));
  const consumables = new Set(data.consumables.map(row => row.key));
  unique(data.assignments.map(row => JSON.stringify([row.kind, row.key, row.label_key])), "category assignments");
  for (const row of data.assignments)
    if (!labels.has(row.label_key) || !(row.kind === "mead" ? meads : consumables).has(row.key)) fail("Unknown category assignment target");
  for (const row of [...data.consumables.map(row => ({ kind: "stock", key: row.key })), ...data.meads.map(row => ({ kind: "mead", key: row.key }))])
    if (data.assignments.filter(link => link.kind === row.kind && link.key === row.key).length > 50) fail("At most 50 categories per entry");
  unique(data.allocations.map(row => JSON.stringify([row.stock_key, row.location_key, row.position])), "storage positions");
  for (const allocation of data.allocations) {
    const stock = stocks.get(allocation.stock_key);
    if (!stock || !locations.has(allocation.location_key)) { fail("Unknown storage target"); continue; }
    if (!validateStockQuantitySafe(stock.category, { value: allocation.quantity, unit: stock.quantity.unit })) fail("Invalid storage quantity");
  }
  for (const [id, stock] of stocks) {
    if (data.allocations.filter(row => row.stock_key === id).length > 100) fail("At most 100 positions per stock row");
    try { validateAllocationTotal(stock.quantity, data.allocations.filter(row => row.stock_key === id).map(row => row.quantity)); }
    catch { fail("Storage allocations exceed stock quantity"); }
  }
});
function validateStockQuantitySafe(category: string, quantity: unknown) {
  try { validateStockQuantity(category, quantity); return true; } catch { return false; }
}
export type InventoryCollection = z.infer<typeof inventoryCollectionSchema>;

export const collectionSheetHeaders = {
  Consumables: ["Stock key", "Name", "Category", "Quantity", "Unit", "Notes", "Catalog type", "Catalog ID"],
  "Finished meads": ["Mead key", "Name", "Notes", "Bottle key", "Size in liters", "Bottle size", "Size unit", "Bottle count"],
  Categories: ["Category key", "Name"],
  Locations: ["Location key", "Name", "Parent key"],
  Assignments: ["Kind", "Item key", "Category key"],
  Storage: ["Stock key", "Location key", "Position", "Quantity"],
} as const;
export type CollectionSheetName = keyof typeof collectionSheetHeaders;
export class CollectionWorkbookError extends Error {
  constructor(readonly sheet?: CollectionSheetName, readonly row?: number) {
    super("Invalid collection workbook");
  }
}

/** Literal, fixed headers make templates editable without interpreting formulas or JSON cells. */
export function collectionFromSheets(sheets: readonly { name: string; rows: readonly (readonly string[])[] }[]): InventoryCollection {
  const rowNumbers = new Map<CollectionSheetName, number[]>();
  const rowNumber = (name: CollectionSheetName, index: number) => rowNumbers.get(name)?.[index] ?? index + 2;
  const rows = (name: CollectionSheetName) => {
    const matches = sheets.filter(sheet => sheet.name === name);
    if (matches.length !== 1 || JSON.stringify(matches[0].rows[0]) !== JSON.stringify(collectionSheetHeaders[name])) throw new CollectionWorkbookError(name, 1);
    const numbers: number[] = [];
    rowNumbers.set(name, numbers);
    return matches[0].rows.slice(1).flatMap((row, index) => {
      if (!row.some(cell => cell.trim())) return [];
      numbers.push(index + 2);
      if (row.length > collectionSheetHeaders[name].length) throw new CollectionWorkbookError(name, index + 2);
      return [row];
    });
  };
  const numeric = (value: string, sheet: CollectionSheetName, row: number) => { if (!value?.trim() || !/^\d+(?:\.\d+)?$/.test(value.trim())) throw new CollectionWorkbookError(sheet, row); return Number(value); };
  const consumables = rows("Consumables").map(([key, name, category, quantity, unit, notes, catalog, id], index) => ({ key, stock: { name, category, quantity: { value: numeric(quantity, "Consumables", rowNumber("Consumables", index)), unit }, notes: notes || null, catalogReference: catalog || id ? { catalog, id } : null } }));
  const meads = new Map<string, { key: string; name: string; notes: string | null; bottles: unknown[] }>();
  for (const [index, [key, name, notes, bottleKey, liters, value, unit, count]] of rows("Finished meads").entries()) {
    const existing = meads.get(key);
    if (existing && (existing.name !== name || existing.notes !== (notes || null))) throw new CollectionWorkbookError("Finished meads", rowNumber("Finished meads", index));
    const mead = existing ?? { key, name, notes: notes || null, bottles: [] };
    const number = (value: string) => numeric(value, "Finished meads", rowNumber("Finished meads", index));
    try {
      const display = value || unit ? bottleDisplaySizeSchema.parse({ value: number(value), unit }) : undefined;
      const sizeLiters = liters?.trim() ? number(liters) : display ? convertQuantity(display, "L").value : number(liters);
      mead.bottles.push({ key: bottleKey, size_liters: sizeLiters, ...(display ? { display_size: display } : {}), quantity: number(count) });
    } catch { throw new CollectionWorkbookError("Finished meads", rowNumber("Finished meads", index)); }
    meads.set(key, mead);
  }
  const result = inventoryCollectionSchema.safeParse({ version: 1, consumables, meads: [...meads.values()],
    labels: rows("Categories").map(([key, name]) => ({ key, name })),
    locations: rows("Locations").map(([key, name, parent]) => ({ key, name, parent_key: parent || null })),
    assignments: rows("Assignments").map(([kind, key, label_key]) => ({ kind, key, label_key })),
    allocations: rows("Storage").map(([stock_key, location_key, position, quantity], index) => ({ stock_key, location_key, position: position || "", quantity: numeric(quantity, "Storage", rowNumber("Storage", index)) })),
  });
  if (!result.success) {
    const issue = result.error.issues[0];
    const names: Record<string, CollectionSheetName> = { consumables: "Consumables", meads: "Finished meads", labels: "Categories", locations: "Locations", assignments: "Assignments", allocations: "Storage" };
    const sheet = names[String(issue.path[0])];
    // Grouped mead indices are not workbook row numbers; avoid misidentifying a row.
    const row = sheet !== "Finished meads" && typeof issue.path[1] === "number" ? rowNumber(sheet, issue.path[1]) : undefined;
    throw new CollectionWorkbookError(sheet, row);
  }
  return result.data;
}

export function collectionToSheets(input: InventoryCollection) {
  const data = inventoryCollectionSchema.parse(input);
  const tables: Record<CollectionSheetName, (string | number)[][]> = {
    Consumables: data.consumables.map(({ key, stock }) => [key, stock.name, stock.category, stock.quantity.value, stock.quantity.unit, stock.notes ?? "", stock.catalogReference?.catalog ?? "", stock.catalogReference?.id ?? ""]),
    "Finished meads": data.meads.flatMap(mead => mead.bottles.map(bottle => [mead.key, mead.name, mead.notes ?? "", bottle.key, bottle.size_liters, bottle.display_size?.value ?? "", bottle.display_size?.unit ?? "", bottle.quantity])),
    Categories: data.labels.map(row => [row.key, row.name]),
    Locations: data.locations.map(row => [row.key, row.name, row.parent_key ?? ""]),
    Assignments: data.assignments.map(row => [row.kind, row.key, row.label_key]),
    Storage: data.allocations.map(row => [row.stock_key, row.location_key, row.position, row.quantity]),
  };
  return (Object.keys(collectionSheetHeaders) as CollectionSheetName[]).map(name => ({ name, rows: [[...collectionSheetHeaders[name]], ...tables[name]] }));
}
