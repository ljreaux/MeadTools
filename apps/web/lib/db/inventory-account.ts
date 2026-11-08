import "server-only";
import { type inventory_stock, type PrismaClient } from "@prisma/client";
import { InventoryError } from "@meadtools/inventory-domain";
import { inventoryStockItemSchema } from "@meadtools/api-contract/inventory";
import type {
  InventoryOverviewResponse,
  InventoryStockHistoryResponse,
} from "@meadtools/api-contract/contracts";
import prisma from "@/lib/prisma";
import { stockReconciliation } from "./inventory-reconciliation";
import { getPremiumAccessStatus } from "./premium-access";
import { costResponse, exclusionResponse } from "./inventory-costs";

export function stockItem(row: inventory_stock) {
  return inventoryStockItemSchema.parse({
    id: row.id,
    name: row.name,
    category: row.category,
    catalogReference:
      row.catalog && row.catalog_id
        ? { catalog: row.catalog, id: row.catalog_id }
        : null,
    quantity: { value: row.quantity.toNumber(), unit: row.unit },
    notes: row.notes,
    reconciliation_required: row.reconciliation_required,
    cost: costResponse(row.unit_cost, row.cost_currency),
  });
}
export function createInventoryAccountReader(database: PrismaClient = prisma) {
  async function access(userId: number) {
    const status = await getPremiumAccessStatus(userId, new Date(), database);
    if (!status.activeUser) throw new InventoryError("NOT_FOUND");
    return status;
  }
  async function overview(userId: number): Promise<InventoryOverviewResponse> {
    const status = await access(userId);
    const [rows, owner, exclusions] = await Promise.all([
      database.inventory_stock.findMany({
        where: { user_id: userId, archived_at: null, category: { not: "mead" } },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      database.users.findUnique({ where: { id: userId }, select: { inventory_currency: true } }),
      database.inventory_cost_exclusions.findMany({ where: { user_id: userId }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
    ]);
    return {
      can_manage: status.premiumEnabled,
      currency: owner?.inventory_currency ?? null,
      cost_exclusions: exclusions.map(exclusionResponse),
      stock: rows.map(stockItem),
    };
  }
  async function history(
    userId: number,
    stockId: string,
  ): Promise<InventoryStockHistoryResponse> {
    const status = await access(userId);
    return database.$transaction(
      async (tx) => {
        const row = await tx.inventory_stock.findFirst({
          where: { id: stockId, user_id: userId, category: { not: "mead" } },
        });
        if (!row) throw new InventoryError("NOT_FOUND");
        const adjustments = await tx.inventory_adjustments.findMany({
          where: { user_id: userId, stock_id: stockId },
          orderBy: [{ created_at: "desc" }, { id: "desc" }],
          take: 101,
        });
        const costEvents = await tx.inventory_cost_events.findMany({
          where: { user_id: userId, stock_id: stockId },
          orderBy: [{ created_at: "desc" }, { id: "desc" }],
          take: 50,
        });

        return {
          ...(row.reconciliation_required && status.premiumEnabled
            ? { reconciliation: await stockReconciliation(tx, userId, row) }
            : {}),
          stock: stockItem(row),
          has_more: adjustments.length > 100,
          adjustments: adjustments.slice(0, 100).map((adjustment) => ({
            id: adjustment.id,
            kind: adjustment.kind,
            delta: adjustment.delta.toNumber(),
            balance_after: {
              value: adjustment.balance_after.toNumber(),
              unit: adjustment.unit,
            },
            note: adjustment.note,
            created_at: adjustment.created_at.toISOString(),
          })),
          cost_events: costEvents.map((event) => ({
            id: event.id,
            kind: event.kind as "receipt" | "valuation",
            received: event.received
              ? { value: event.received.toNumber(), unit: event.unit }
              : null,
            price:
              event.price_amount && event.price_currency && event.price_per_value && event.price_per_unit
                ? {
                    amount: event.price_amount.toNumber(),
                    currency: event.price_currency,
                    per: { value: event.price_per_value.toNumber(), unit: event.price_per_unit },
                  }
                : null,
            applied_unit_cost: event.applied_unit_cost?.toNumber() ?? null,
            before: costResponse(event.unit_cost_before, event.currency_before),
            after: costResponse(event.unit_cost_after, event.currency_after),
            note: event.note,
            created_at: event.created_at.toISOString(),
          })),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  return { overview, history };
}
