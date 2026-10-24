import "server-only";
import { type inventory_stock, type PrismaClient } from "@prisma/client";
import { InventoryError } from "@meadtools/inventory-domain";
import { inventoryStockItemSchema } from "@meadtools/api-contract/inventory";
import type { InventoryOverviewResponse, InventoryStockHistoryResponse } from "@meadtools/api-contract/contracts";
import prisma from "@/lib/prisma";
import { getPremiumAccessStatus } from "./premium-access";

function stockItem(row: inventory_stock) {
  return inventoryStockItemSchema.parse({
    id: row.id, name: row.name, category: row.category,
    catalogReference: row.catalog && row.catalog_id ? { catalog: row.catalog, id: row.catalog_id } : null,
    quantity: { value: row.quantity.toNumber(), unit: row.unit }, notes: row.notes,
    reconciliation_required: row.reconciliation_required,
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
    const rows = await database.inventory_stock.findMany({ where: { user_id: userId, archived_at: null }, orderBy: [{ category: "asc" }, { name: "asc" }] });
    return { can_manage: status.premiumEnabled, stock: rows.map(stockItem) };
  }
  async function history(userId: number, stockId: string): Promise<InventoryStockHistoryResponse> {
    await access(userId);
    const row = await database.inventory_stock.findFirst({ where: { id: stockId, user_id: userId } });
    if (!row) throw new InventoryError("NOT_FOUND");
    const adjustments = await database.inventory_adjustments.findMany({
      where: { user_id: userId, stock_id: stockId }, orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 101,
    });
    return { stock: stockItem(row), has_more: adjustments.length > 100, adjustments: adjustments.slice(0, 100).map((adjustment) => ({
      id: adjustment.id, kind: adjustment.kind, delta: adjustment.delta.toNumber(),
      balance_after: { value: adjustment.balance_after.toNumber(), unit: adjustment.unit },
      note: adjustment.note, created_at: adjustment.created_at.toISOString(),
    })) };
  }
  return { overview, history };
}
