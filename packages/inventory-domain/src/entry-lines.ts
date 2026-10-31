import { z } from "zod";
import {
  convertQuantity,
  quantitySchema,
  normalizeQuantityUnit,
  toQuantityTicks,
  fromQuantityTicks,
  InventoryError,
  type Quantity,
} from "./quantity";
import { catalogReferenceSchema, type CatalogReference } from "./schemas";
import { nutrientReference, stabilizerReference } from "./catalog";
export type InventoryLine = {
  key: string;
  name: string;
  kind: string;
  quantity: Quantity;
  catalogReference?: CatalogReference | null;
};
export type InventoryUse = {
  line_key: string;
  stock_id: string;
  deducted: Quantity;
};
export type InventoryBinding = { line_key: string; stock_id: string | null };
const componentSchema = z.object({
  key: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  amount: z.number().nonnegative(),
  unit: z.string(),
});
const count = z.number().int().min(0).max(1_000_000_000);
const packagingSchema = z.object({
  bottleRows: z
    .array(
      z.object({
        label: z.string().optional(),
        quantity: count,
        sizeLiters: z.number().positive(),
      }),
    )
    .max(50)
    .default([]),
  closures: z
    .array(z.object({ name: z.string().min(1).max(200), quantity: count }))
    .max(50)
    .default([]),
});
/** These keys identify physical uses within one entry, independently of stock names. */
export function inventoryEntryLines(
  type: string,
  data: unknown,
): InventoryLine[] {
  if (type === "PACKAGING") {
    const value = packagingSchema.parse(data);
    return [
      ...value.bottleRows.map((row, index) => ({
        key: `bottle:${index}`,
        name: `${Number((row.sizeLiters * 1000).toFixed(3))} mL bottles`,
        kind: "PACKAGING",
        quantity: { value: row.quantity, unit: "units" as const },
      })),
      ...value.closures.map((row, index) => ({
        key: `closure:${index}`,
        name: row.name,
        kind: "PACKAGING",
        quantity: { value: row.quantity, unit: "units" as const },
      })),
    ].filter((line) => line.quantity.value > 0);
  }
  if (
    type !== "ADDITION" ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  )
    return [];
  const value = data as Record<string, unknown>;
  const meta = value.meta as
    | {
        components?: unknown[];
        catalogReference?: unknown;
        yeastId?: number | string;
        nutrientKey?: string;
        stabilizerKind?: string;
        stabilizerType?: string;
        sulfiteForm?: string;
      }
    | undefined;
  if (Array.isArray(meta?.components) && meta.components.length) {
    const components = z.array(componentSchema).max(50).parse(meta.components);
    if (new Set(components.map((item) => item.key)).size !== components.length)
      throw new InventoryError("LINK_MISMATCH");
    return components
      .filter((item) => item.amount > 0)
      .map((item) => ({
        key: `component:${item.key}`,
        name: item.name,
        kind: String(value.kind ?? "NUTRIENT"),
        quantity: quantitySchema.parse({
          value: item.amount,
          unit: normalizeQuantityUnit(item.unit),
        }),
        catalogReference: nutrientReference(item.key),
      }));
  }
  if (value.amount == null || value.amount === 0) return [];
  const reference = catalogReferenceSchema.safeParse(meta?.catalogReference);
  const catalogReference = reference.success
    ? reference.data
    : value.kind === "YEAST" && meta?.yeastId
      ? { catalog: "yeast" as const, id: String(meta.yeastId) }
      : (nutrientReference(meta?.nutrientKey) ?? stabilizerReference(meta));
  return [
    {
      catalogReference,
      key: "addition",
      name: String(value.name ?? ""),
      kind: String(value.kind ?? "INGREDIENT"),
      quantity: quantitySchema.parse({
        value: value.amount,
        unit: normalizeQuantityUnit(value.unit),
      }),
    },
  ];
}
export function tryInventoryEntryLines(
  type: string,
  data: unknown,
): InventoryLine[] {
  try {
    return inventoryEntryLines(type, data);
  } catch {
    return [];
  }
}
export function lineCategories(
  line: Pick<InventoryLine, "kind" | "name">,
): string[] {
  if (line.kind === "PACKAGING") return ["packaging"];
  if (line.kind === "YEAST") return ["yeast"];
  if (line.kind === "NUTRIENT" || line.kind === "OTHER") return ["additive"];
  return /\bhoney\b/i.test(line.name) ? ["honey"] : ["honey", "fruit"];
}
/** Return previous uses, then deduct all new uses in stock units. Shared stock is checked once. */
export function planEntryInventory(input: {
  stocks: readonly { id: string; category: string; quantity: Quantity }[];
  lines: readonly InventoryLine[];
  bindings: readonly InventoryBinding[];
  previous: readonly InventoryUse[];
}) {
  const stocks = new Map(input.stocks.map((stock) => [stock.id, stock]));
  const deltas = new Map<string, bigint>();
  const next: InventoryUse[] = [];
  const add = (id: string, ticks: number) =>
    deltas.set(id, (deltas.get(id) ?? BigInt(0)) + BigInt(ticks));
  for (const old of input.previous) {
    const stock = stocks.get(old.stock_id);
    if (!stock) throw new InventoryError("NOT_FOUND");
    if (stock.quantity.unit !== old.deducted.unit)
      throw new InventoryError("LINK_MISMATCH");
    add(stock.id, toQuantityTicks(old.deducted.value));
  }
  for (const line of input.lines) {
    const binding = input.bindings.find((item) => item.line_key === line.key);
    if (!binding?.stock_id) continue;
    const stock = stocks.get(binding.stock_id);
    if (!stock) throw new InventoryError("NOT_FOUND");
    if (!lineCategories(line).includes(stock.category))
      throw new InventoryError("LINK_MISMATCH");
    const deducted = convertQuantity(line.quantity, stock.quantity.unit);
    add(stock.id, -toQuantityTicks(deducted.value));
    next.push({ line_key: line.key, stock_id: stock.id, deducted });
  }
  const balances = Array.from(deltas, ([id, delta]) => {
    const stock = stocks.get(id)!;
    const ticks = BigInt(toQuantityTicks(stock.quantity.value)) + delta;
    if (ticks < BigInt(0))
      throw new InventoryError("INSUFFICIENT_STOCK", {
        shortage: Number(-ticks) / 1e6,
        unit: stock.quantity.unit,
        stock_id: id,
      });
    const balance = {
      value: fromQuantityTicks(Number(ticks)),
      unit: stock.quantity.unit,
    };
    const adjustment = Number(delta) / 1e6;
    if (!Number.isSafeInteger(Number(delta)))
      throw new InventoryError("INVALID_QUANTITY");
    return { stock_id: id, quantity: balance, adjustment };
  });
  return { uses: next, balances };
}
