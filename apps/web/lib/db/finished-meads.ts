import "server-only";
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { InventoryError, finishedMeadInputSchema, planStockChange } from "@meadtools/inventory-domain";
import {
  finishedMeadItemSchema,
  finishedMeadMutationResponseSchema,
  updateFinishedMeadRequestBodySchema,
} from "@meadtools/api-contract/inventory";
import prisma from "@/lib/prisma";
import type { InventoryStorageSource } from "@meadtools/api-contract/contracts";
import { createInventoryOperation, InventoryWriteError, writeInventoryBalance } from "./inventory";
import { getPremiumAccessStatus } from "./premium-access";

type MeadRow = Prisma.inventory_meadsGetPayload<{ include: { stock: true } }>;
function item(row: MeadRow) {
  const bottles = row.stock.map((stock) => ({
    id: stock.id,
    size_liters: stock.bottle_size_liters!.toNumber(),
    quantity: stock.quantity.toNumber(),
  })).sort((a, b) => a.size_liters - b.size_liters);
  // The counter invalidates old forms even if a change is later reversed,
  // including multiple writes within one timestamp's precision.
  const revision = createHash("sha256").update(JSON.stringify({
    id: row.id, name: row.name, notes: row.notes, archived: row.archived_at,
    version: row.version, updated: row.updated_at, bottles,
    stockUpdated: [...row.stock].sort((a, b) => a.id.localeCompare(b.id)).map((stock) => [stock.id, stock.updated_at]),
  })).digest("hex");
  return finishedMeadItemSchema.parse({ id: row.id, name: row.name, notes: row.notes, bottles, revision });
}

export function createFinishedMeadService(database: PrismaClient = prisma) {
  const operation = createInventoryOperation(database);
  async function access(userId: number) {
    const status = await getPremiumAccessStatus(userId, new Date(), database);
    if (!status.activeUser) throw new InventoryError("NOT_FOUND");
    return status;
  }
  async function owned(tx: Prisma.TransactionClient, userId: number, id: string) {
    const mead = await tx.inventory_meads.findFirst({
      where: { id, user_id: userId }, include: { stock: true },
    });
    if (!mead) throw new InventoryError("NOT_FOUND");
    return mead;
  }
  async function overview(userId: number) {
    const status = await access(userId);
    const rows = await database.inventory_meads.findMany({
      where: { user_id: userId, archived_at: null },
      include: { stock: true }, orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return { can_manage: status.premiumEnabled, meads: rows.map(item) };
  }
  async function history(userId: number, id: string) {
    await access(userId);
    return database.$transaction(async (tx) => {
      const mead = await owned(tx, userId, id);
      const changes = await tx.inventory_adjustments.findMany({
        where: { user_id: userId, stock: { mead_id: id } },
        include: { stock: { select: { bottle_size_liters: true } }, bottling: true },
        orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 101,
      });
      const sourceEntries=await tx.brew_entries.findMany({where:{user_id:userId,id:{in:changes.flatMap(change=>change.bottling?[change.bottling.entry_id]:[])}},select:{id:true,brew_id:true}});
      return {
        mead: item(mead), has_more: changes.length > 100,
        adjustments: changes.slice(0, 100).map((change) => ({
          id: change.id, kind: change.kind,
          source: change.bottling ? {name:change.bottling.source_name,brew_id:change.bottling.brew_id,entry_id:change.bottling.entry_id,removed:!!change.bottling.removed_at || !sourceEntries.some(entry=>entry.id===change.bottling!.entry_id&&entry.brew_id===change.bottling!.brew_id)} : null,
          size_liters: change.stock.bottle_size_liters!.toNumber(),
          delta: change.delta.toNumber(), balance_after: change.balance_after.toNumber(),
          note: change.note, created_at: change.created_at.toISOString(),
        })),
      };
    }, { isolationLevel: "RepeatableRead" });
  }
  async function addBottles(tx: Prisma.TransactionClient, userId: number, operationId: string,
    mead: { id: string; name: string }, size: number, count: number, note: string | null = null) {
    const stock = await tx.inventory_stock.create({ data: {
      user_id: userId, mead_id: mead.id, name: mead.name, category: "mead",
      bottle_size_liters: size, unit: "units", quantity: 0,
    } });
    await changeBalance(tx, userId, operationId, stock, "receipt", count, note);
  }
  async function changeBalance(tx: Prisma.TransactionClient, userId: number, operationId: string,
    stock: MeadRow["stock"][number], kind: "receipt" | "manual_use" | "correction", count: number, note: string | null, source?: InventoryStorageSource) {
    const plan = planStockChange({
      ownerId: userId,
      stock: { id: stock.id, ownerId: userId, catalogReference: null,
        quantity: { value: stock.quantity.toNumber(), unit: "units" } },
      kind, quantity: { value: count, unit: "units" },
    });
    await writeInventoryBalance(tx, userId, operationId, stock, plan, kind, null, note, source);
  }
  async function create(userId: number, operationKey: string, input: unknown) {
    const parsed = finishedMeadInputSchema.parse(input);
    return operation(userId, operationKey, { kind: "create_finished_mead", input: parsed },
      (value) => finishedMeadMutationResponseSchema.parse(value), async (tx, operationId) => {
        const mead = await tx.inventory_meads.create({ data: { user_id: userId, name: parsed.name, notes: parsed.notes } });
        for (const bottle of parsed.bottles)
          await addBottles(tx, userId, operationId, mead, bottle.size_liters, bottle.quantity);
        return { mead_id: mead.id };
      });
  }
  async function update(userId: number, id: string, input: unknown) {
    const parsed = updateFinishedMeadRequestBodySchema.parse(input);
    return operation(userId, parsed.operation_id, { kind: "change_finished_mead", id, input: parsed },
      (value) => finishedMeadMutationResponseSchema.parse(value), async (tx, operationId) => {
        const mead = await owned(tx, userId, id);
        if (mead.archived_at) throw new InventoryWriteError("STOCK_ARCHIVED");
        if (item(mead).revision !== parsed.expected_revision) throw new InventoryWriteError("STALE_STOCK");
        if (parsed.action === "details") {
          await tx.inventory_meads.update({ where: { id }, data: { name: parsed.name, notes: parsed.notes, version: { increment: 1 } } });
          await tx.inventory_stock.updateMany({ where: { mead_id: id, user_id: userId }, data: { name: parsed.name } });
        } else if (parsed.action === "archive") {
          if (await tx.inventory_allocations.count({ where: { user_id: userId, stock: { mead_id: id } } })) throw new InventoryWriteError("STORAGE_IN_USE");
          const now = new Date();
          await tx.inventory_meads.update({ where: { id }, data: { archived_at: now, version: { increment: 1 } } });
          await tx.inventory_stock.updateMany({ where: { mead_id: id, user_id: userId }, data: { archived_at: now } });
        } else {
          const stock = mead.stock.find((stock) => stock.bottle_size_liters!.toNumber() === parsed.size_liters);
          if (!stock) {
            if (parsed.action !== "receipt") throw new InventoryError("NOT_FOUND");
            if (mead.stock.length >= 50) throw new InventoryError("INVALID_QUANTITY");
            await addBottles(tx, userId, operationId, mead, parsed.size_liters, parsed.quantity, parsed.note);
          } else {
            await changeBalance(tx, userId, operationId, stock, parsed.action, parsed.quantity, parsed.note, parsed.storage_source);
          }
          await tx.inventory_meads.update({ where: { id }, data: { version: { increment: 1 } } });
        }
        return { mead_id: id };
      });
  }
  return { overview, history, create, update };
}
