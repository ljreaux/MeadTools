import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";
import { inventoryCollectionSchema, inventoryLocationPaths, InventoryError, type InventoryCollection } from "@meadtools/inventory-domain";
import prisma from "@/lib/prisma";
import { createInventoryOperation, validateInventoryCatalog } from "./inventory";
import { storedBottleDisplaySize } from "./inventory-bottle-size";
import { stockItem } from "./inventory-account";
import { getPremiumAccessStatus } from "./premium-access";

export function createInventoryCollectionService(database: PrismaClient = prisma) {
  const operation = createInventoryOperation(database);
  async function snapshot(userId: number): Promise<InventoryCollection> {
    const status = await getPremiumAccessStatus(userId, new Date(), database);
    if (!status.activeUser) throw new InventoryError("NOT_FOUND");
    return database.$transaction(async tx => {
      const [stocks, meads, labels, locations, assignments] = await Promise.all([
        tx.inventory_stock.findMany({ where: { user_id: userId, archived_at: null }, include: { allocations: true }, orderBy: { id: "asc" } }),
        tx.inventory_meads.findMany({ where: { user_id: userId, archived_at: null }, orderBy: { id: "asc" } }),
        tx.inventory_labels.findMany({ where: { user_id: userId, archived_at: null }, orderBy: { id: "asc" } }),
        tx.inventory_locations.findMany({ where: { user_id: userId, archived_at: null }, orderBy: { id: "asc" } }),
        tx.inventory_label_links.findMany({ where: { user_id: userId, label: { archived_at: null } }, orderBy: { id: "asc" } }),
      ]);
      const stockIds = new Set(stocks.filter(row => !row.mead_id).map(row => row.id));
      const meadIds = new Set(meads.map(row => row.id));
      return inventoryCollectionSchema.parse({
        version: 1,
        consumables: stocks.filter(row => !row.mead_id).map(row => {
          const { name, category, quantity, notes, catalogReference } = stockItem(row);
          return { key: row.id, stock: { name, category, quantity, notes, catalogReference } };
        }),
        meads: meads.map(row => ({ key: row.id, name: row.name, notes: row.notes, bottles: stocks.filter(stock => stock.mead_id === row.id).map(stock => ({ key: stock.id, size_liters: stock.bottle_size_liters!.toNumber(), quantity: stock.quantity.toNumber(), ...(storedBottleDisplaySize(stock) ? { display_size: storedBottleDisplaySize(stock) } : {}) })) })),
        labels: labels.map(row => ({ key: row.id, name: row.name })),
        locations: locations.map(row => ({ key: row.id, name: row.name, parent_key: row.parent_id })),
        assignments: assignments.filter(row => row.mead_id ? meadIds.has(row.mead_id) : stockIds.has(row.stock_id!)).map(row => ({ kind: row.mead_id ? "mead" : "stock", key: row.mead_id ?? row.stock_id, label_key: row.label_id })),
        allocations: stocks.flatMap(stock => stock.allocations.map(row => ({ stock_key: stock.id, location_key: row.location_id, position: row.position, quantity: row.quantity.toNumber() }))),
      });
    }, { isolationLevel: "RepeatableRead" });
  }

  async function restore(userId: number, operationKey: string, input: unknown) {
    const data = inventoryCollectionSchema.parse(input);
    const resultSchema = z.object({ created: z.number().int().nonnegative(), updated: z.literal(0) });
    return operation(userId, operationKey, JSON.parse(JSON.stringify({ kind: "import_collection", data })), result => resultSchema.parse(result), async (tx, operationId) => {
      // Portable keys never select an existing stock/brew. Every imported entry is new.
      const stockIds = new Map<string, string>(), meadIds = new Map<string, string>();
      const labelIds = new Map<string, string>(), locationIds = new Map<string, string>();
      const normalize = (name: string) => name.normalize("NFKC").trim().toLowerCase();
      const existingLabels = await tx.inventory_labels.findMany({ where: { user_id: userId, archived_at: null } });
      const newLabels = [];
      for (const label of data.labels) {
        const existing = existingLabels.find(row => normalize(row.name) === normalize(label.name));
        const id = existing?.id ?? randomUUID();
        if (!existing) newLabels.push({ id, user_id: userId, name: label.name });
        labelIds.set(label.key, id);
      }
      if (newLabels.length) await tx.inventory_labels.createMany({ data: newLabels });
      const existingLocations = await tx.inventory_locations.findMany({ where: { user_id: userId, archived_at: null } });
      let pending = [...data.locations];
      while (pending.length) {
        const ready = pending.filter(row => !row.parent_key || locationIds.has(row.parent_key));
        if (!ready.length) throw new InventoryError("LINK_MISMATCH");
        const newLocations = ready.map(location => {
          const parentId = location.parent_key ? locationIds.get(location.parent_key)! : null;
          const existing = existingLocations.find(row => row.parent_id === parentId && normalize(row.name) === normalize(location.name));
          const id = existing?.id ?? randomUUID();
          locationIds.set(location.key, id);
          return existing ? null : { id, user_id: userId, name: location.name, parent_id: parentId };
        }).filter(row => row !== null);
        if (newLocations.length) await tx.inventory_locations.createMany({ data: newLocations });
        const done = new Set(ready.map(row => row.key));
        pending = pending.filter(row => !done.has(row.key));
      }
      const newStocks: Prisma.inventory_stockCreateManyInput[] = [];
      const checkedCatalogs = new Set<string>();
      for (const row of data.consumables) {
        const catalogKey = JSON.stringify([row.stock.category, row.stock.catalogReference]);
        if (!checkedCatalogs.has(catalogKey)) {
          await validateInventoryCatalog(tx, row.stock.category, row.stock.catalogReference);
          checkedCatalogs.add(catalogKey);
        }
        const id = randomUUID();
        newStocks.push({ id, user_id: userId, name: row.stock.name, category: row.stock.category, notes: row.stock.notes, quantity: row.stock.quantity.value, unit: row.stock.quantity.unit, catalog: row.stock.catalogReference?.catalog ?? null, catalog_id: row.stock.catalogReference?.id ?? null });
        stockIds.set(row.key, id);
      }
      const newMeads = data.meads.map(row => {
        const id = randomUUID(); meadIds.set(row.key, id);
        for (const bottle of row.bottles) {
          const stockId = randomUUID(); stockIds.set(bottle.key, stockId);
          newStocks.push({ id: stockId, user_id: userId, mead_id: id, name: row.name, category: "mead", unit: "units", quantity: bottle.quantity, bottle_size_liters: bottle.size_liters, bottle_size_value: bottle.display_size?.value ?? null, bottle_size_unit: bottle.display_size?.unit ?? null });
        }
        return { id, user_id: userId, name: row.name, notes: row.notes };
      });
      if (newMeads.length) await tx.inventory_meads.createMany({ data: newMeads });
      if (newStocks.length) await tx.inventory_stock.createMany({ data: newStocks });
      const stocks = await tx.inventory_stock.findMany({ where: { user_id: userId, id: { in: [...stockIds.values()] } } });
      const receipts = stocks.filter(row => row.quantity.gt(0)).map(row => ({ user_id: userId, stock_id: row.id, operation_id: operationId, kind: "receipt", delta: row.quantity, balance_after: row.quantity, unit: row.unit }));
      if (receipts.length) await tx.inventory_adjustments.createMany({ data: receipts });
      if (data.assignments.length) await tx.inventory_label_links.createMany({ data: data.assignments.map(row => ({ user_id: userId, label_id: labelIds.get(row.label_key)!, ...(row.kind === "mead" ? { mead_id: meadIds.get(row.key)! } : { stock_id: stockIds.get(row.key)! }) })) });
      const paths = inventoryLocationPaths(await tx.inventory_locations.findMany({ where: { user_id: userId, archived_at: null } }));
      const stockById = new Map(stocks.map(row => [row.id, row]));
      if (data.allocations.length) {
        const allocations = data.allocations.map(row => ({ user_id: userId, stock_id: stockIds.get(row.stock_key)!, location_id: locationIds.get(row.location_key)!, position: row.position, quantity: row.quantity, unit: stockById.get(stockIds.get(row.stock_key)!)!.unit }));
        await tx.inventory_allocations.createMany({ data: allocations });
        await tx.inventory_storage_events.createMany({ data: data.allocations.map((row, index) => ({ user_id: userId, stock_id: allocations[index].stock_id, operation_id: operationId, unit: allocations[index].unit, location_path: paths.get(locationIds.get(row.location_key)!)!, position: row.position, delta: row.quantity, balance_after: row.quantity, reason: "move" })) });
        await tx.inventory_stock.updateMany({ where: { id: { in: [...new Set(allocations.map(row => row.stock_id))] }, user_id: userId }, data: { storage_version: { increment: 1 } } });
      }
      return { created: data.consumables.length + data.meads.length, updated: 0 as const };
    });
  }
  return { snapshot, restore };
}
