import type { CatalogReference } from "./schemas";
import {
  convertQuantity, fromQuantityTicks, InventoryError, quantitySchema,
  toQuantityTicks, type Quantity
} from "./quantity";

export type StockRecord = {
  id: string;
  ownerId: number;
  catalogReference: CatalogReference | null;
  quantity: Quantity;
};

export type StockMatch =
  | { status: "untracked" }
  | { status: "matched"; stockId: string }
  | { status: "ambiguous"; stockIds: string[] };

/** Names and recipe line IDs are not reliable catalog identities. */
export function matchOwnedStock(
  ownerId: number,
  reference: CatalogReference | null,
  stock: readonly StockRecord[]
): StockMatch {
  if (!reference) return { status: "untracked" };
  const candidates = stock.filter((item) => item.ownerId === ownerId &&
    item.catalogReference?.catalog === reference.catalog &&
    item.catalogReference.id === reference.id);
  if (candidates.length === 0) return { status: "untracked" };
  if (candidates.length > 1) {
    return { status: "ambiguous", stockIds: candidates.map((item) => item.id).sort() };
  }
  return { status: "matched", stockId: candidates[0].id };
}

export type ConsumptionLink = {
  stockId: string;
  ownerId: number;
  brewId: string;
  entryId: string;
  // The amount actually deducted, rounded in the stock unit, is authoritative
  // for reversal. Never reconstruct it from a possibly changed recipe/catalog.
  deducted: Quantity;
};

export type ConsumptionPlan = {
  balance: Quantity;
  /** Positive adds stock; negative consumes it. Persist alongside the link. */
  adjustment: number;
  link: ConsumptionLink | null;
};

/**
 * Pure calculation, not a database write or a concurrency/idempotency boundary.
 * Adapters must lock stock/link rows and persist entry, balance, link and audit
 * adjustment in one transaction. Read the existing link inside that transaction.
 * A null usage means correcting/removing an erroneous use, never brew deletion.
 */
export function planConsumption(input: {
  ownerId: number;
  brew: { id: string; ownerId: number };
  entryId: string;
  stock: StockRecord;
  previous: ConsumptionLink | null;
  usage: Quantity | null;
}): ConsumptionPlan {
  const { ownerId, brew, entryId, stock, previous, usage } = input;
  if (stock.ownerId !== ownerId || brew.ownerId !== ownerId) {
    throw new InventoryError("NOT_FOUND");
  }
  if (previous && (previous.ownerId !== ownerId || previous.stockId !== stock.id ||
    previous.entryId !== entryId || previous.brewId !== brew.id ||
    previous.deducted.unit !== stock.quantity.unit)) {
    throw new InventoryError("LINK_MISMATCH");
  }
  const balance = toQuantityTicks(stock.quantity.value);
  const before = previous ? toQuantityTicks(previous.deducted.value) : 0;
  const deducted = usage ? convertQuantity(usage, stock.quantity.unit) : null;
  const after = deducted ? toQuantityTicks(deducted.value) : 0;
  const delta = before - after;
  if (balance + delta < 0) {
    throw new InventoryError("INSUFFICIENT_STOCK", {
      shortage: fromQuantityTicks(-(balance + delta)), unit: stock.quantity.unit
    });
  }
  return {
    balance: { value: fromQuantityTicks(balance + delta), unit: stock.quantity.unit },
    adjustment: delta / 1_000_000,
    link: deducted ? { stockId: stock.id, ownerId, brewId: brew.id, entryId, deducted } : null
  };
}

/** Receipt/manual use/absolute correction. The adapter supplies the reason. */
export function planStockChange(input: {
  ownerId: number;
  stock: StockRecord;
  kind: "receipt" | "manual_use" | "correction";
  quantity: Quantity;
}): Pick<ConsumptionPlan, "balance" | "adjustment"> {
  const { stock } = input;
  if (stock.ownerId !== input.ownerId) throw new InventoryError("NOT_FOUND");
  const current = toQuantityTicks(quantitySchema.parse(stock.quantity).value);
  const amount = toQuantityTicks(convertQuantity(input.quantity, stock.quantity.unit).value);
  const next = input.kind === "correction" ? amount :
    current + (input.kind === "receipt" ? amount : -amount);
  if (next < 0) {
    throw new InventoryError("INSUFFICIENT_STOCK", {
      shortage: fromQuantityTicks(-next), unit: stock.quantity.unit
    });
  }
  return {
    balance: { value: fromQuantityTicks(next), unit: stock.quantity.unit },
    adjustment: (next - current) / 1_000_000
  };
}
