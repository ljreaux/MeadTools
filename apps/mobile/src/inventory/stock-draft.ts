import type {
  CreateInventoryStockRequestBody,
  InventoryStockHistoryResponse,
  InventoryStockItem,
  InventoryStorageSource,
  UpdateInventoryStockRequestBody
} from "@meadtools/api-contract";
import {
  stockInputSchema,
  validateStockQuantity,
  type CatalogReference,
  type PurchasePrice,
  type QuantityUnit
} from "@meadtools/inventory-domain";

import { parseDecimalInput } from "../outbox/gravity-entry-form";

export type StockAction = "add" | "details" | "receipt" | "manual_use" | "correction" | "reconcile" | "set_unit_cost";
export type StockCategory = InventoryStockItem["category"];

export type StockDraft = {
  name: string;
  category: StockCategory;
  unit: QuantityUnit;
  amount: string;
  notes: string;
  catalogReference: CatalogReference | null;
  storageSource?: InventoryStorageSource;
};

export type StockCommand =
  | { kind: "create"; input: CreateInventoryStockRequestBody }
  | { kind: "update"; stockId: string; input: UpdateInventoryStockRequestBody };

export function buildStockCommand(
  action: StockAction,
  draft: StockDraft,
  review: InventoryStockHistoryResponse | undefined,
  operationId: string,
  price: PurchasePrice | null = null
): StockCommand | null {
  const item = review?.stock;
  const notes = draft.notes.trim() || null;
  if (action === "set_unit_cost") return item && price ? {
    kind: "update", stockId: item.id,
    input: { action, operation_id: operationId, price, note: notes }
  } : null;
  if (action === "details") {
    const name = stockInputSchema.shape.name.safeParse(draft.name);
    return item && name.success
      ? {
          kind: "update",
          stockId: item.id,
          input: {
            action,
            operation_id: operationId,
            name: name.data,
            catalogReference: draft.catalogReference,
            notes
          }
        }
      : null;
  }

  const value = parseDecimalInput(draft.amount);
  if (value === null || (value === 0 && (action === "receipt" || action === "manual_use"))) {
    return null;
  }
  let quantity;
  try {
    quantity = validateStockQuantity(item?.category ?? draft.category, {
      value,
      unit: item?.quantity.unit ?? draft.unit
    });
  } catch {
    return null;
  }

  if (action === "add") {
    const stock = stockInputSchema.safeParse({
      name: draft.name,
      category: draft.category,
      quantity,
      notes,
      catalogReference: draft.catalogReference
    });
    return stock.success
      ? { kind: "create", input: { stock: stock.data, price, operation_id: operationId } }
      : null;
  }
  if (!item) return null;
  if (action === "reconcile") {
    return review.reconciliation
      ? {
          kind: "update",
          stockId: item.id,
          input: {
            action,
            operation_id: operationId,
            revision: review.reconciliation.revision,
            quantity,
            note: notes
          }
        }
      : null;
  }
  return {
    kind: "update",
    stockId: item.id,
    input: {
      action, operation_id: operationId, quantity, expected_balance: item.quantity, note: notes,
      ...(action === "manual_use" && draft.storageSource !== undefined ? { storage_source: draft.storageSource } : {}),
      ...(action === "receipt" && price ? { price } : {})
    }
  };
}
