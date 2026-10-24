import "server-only";

import { createHash } from "node:crypto";
import { Prisma, type PrismaClient, type inventory_stock } from "@prisma/client";
import { z } from "zod";
import {
  InventoryError, convertQuantity, planConsumption, planStockChange,
  normalizeQuantityUnit, quantitySchema, resolveInventoryAccess, stockInputSchema, toQuantityTicks,
  type ConsumptionLink, type Quantity, type StockRecord,
} from "@meadtools/inventory-domain";
import prisma from "@/lib/prisma";
import { getPremiumAccessStatus } from "./premium-access";

export class InventoryWriteError extends Error {
  constructor(public readonly code:
    | "PREMIUM_REQUIRED" | "OPERATION_CONFLICT" | "STALE_USAGE"
    | "USAGE_REMOVED" | "ENTRY_MISMATCH" | "STOCK_ARCHIVED" | "STALE_STOCK" | "SELECTION_REQUIRED"
    | "RECONCILIATION_REQUIRED") {
    super(code);
    this.name = "InventoryWriteError";
  }
}

const uuid = z.string().uuid();
const stockResultSchema = z.object({ stockId: uuid, balance: quantitySchema });
const usageResultSchema = z.object({
  entryId: uuid,
  removed: z.boolean(),
  balances: z.array(stockResultSchema),
});
type StockResult = z.infer<typeof stockResultSchema>;
type UsageResult = z.infer<typeof usageResultSchema>;
type Tx = Prisma.TransactionClient;

function canonicalJson(value: Prisma.InputJsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item!)).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item!)}`).join(",")}}`;
}

function stockRecord(stock: inventory_stock): StockRecord {
  return {
    id: stock.id,
    ownerId: stock.user_id,
    // Matching is performed separately; calculations need only owned ID/quantity.
    catalogReference: null,
    quantity: { value: stock.quantity.toNumber(), unit: stock.unit },
  };
}

/** Small-account serialization also protects absent operation/consumption rows.
 * All inventory writes lock account -> brew -> entry -> stock IDs in order.
 * No lock, credentials, or persistence types escape to the shared domain package.
 */
export function createInventoryService(database: PrismaClient = prisma) {
  async function operation<T extends Prisma.InputJsonObject>(
    userId: number, operationKey: string, request: Prisma.InputJsonObject,
    readResult: (result: Prisma.JsonValue) => T,
    mutate: (tx: Tx, operationId: string) => Promise<T>,
  ): Promise<T> {
    uuid.parse(operationKey);
    const requestHash = createHash("sha256").update(canonicalJson(request)).digest("hex");
    return database.$transaction(async (tx) => {
      const owners = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM users WHERE id = ${userId} FOR UPDATE
      `;
      if (!owners.length) throw new InventoryError("NOT_FOUND");
      const status = await getPremiumAccessStatus(userId, new Date(), tx);
      if (!resolveInventoryAccess(status).canManage) throw new InventoryWriteError("PREMIUM_REQUIRED");
      const previous = await tx.inventory_operations.findUnique({
        where: { user_id_operation_key: { user_id: userId, operation_key: operationKey } },
      });
      if (previous) {
        if (previous.request_hash !== requestHash) throw new InventoryWriteError("OPERATION_CONFLICT");
        return readResult(previous.result);
      }
      const op = await tx.inventory_operations.create({
        data: { user_id: userId, operation_key: operationKey, request_hash: requestHash, result: {} },
      });
      const result = await mutate(tx, op.id);
      await tx.inventory_operations.update({ where: { id: op.id }, data: { result } });
      return result;
    }, { maxWait: 10_000, timeout: 15_000 });
  }

  async function lockStock(tx: Tx, userId: number, ids: string[]) {
    const uniqueIds = [...new Set(ids)].sort();
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM inventory_stock
      WHERE user_id = ${userId} AND id IN (${Prisma.join(uniqueIds.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY id FOR UPDATE
    `);
    const rows = await tx.inventory_stock.findMany({ where: { user_id: userId, id: { in: uniqueIds } } });
    if (rows.length !== uniqueIds.length) throw new InventoryError("NOT_FOUND");
    return new Map(rows.map((row) => [row.id, row]));
  }

  async function writeBalance(
    tx: Tx, userId: number, operationId: string, stock: inventory_stock,
    plan: { balance: Quantity; adjustment: number }, kind: string,
    consumptionId: string | null = null, note: string | null = null,
  ) {
    if (plan.adjustment === 0) return;
    await tx.inventory_stock.update({ where: { id: stock.id }, data: { quantity: plan.balance.value } });
    await tx.inventory_adjustments.create({ data: {
      user_id: userId, stock_id: stock.id, operation_id: operationId,
      consumption_id: consumptionId, kind, delta: plan.adjustment,
      balance_after: plan.balance.value, unit: stock.unit, note,
    } });
  }

  async function createStock(
    userId: number, operationKey: string, input: z.input<typeof stockInputSchema>,
  ): Promise<StockResult> {
    const parsed = stockInputSchema.parse(input);
    return operation(userId, operationKey, { kind: "create_stock", input: parsed },
      (result) => stockResultSchema.parse(result), async (tx, operationId) => {
        const stock = await tx.inventory_stock.create({ data: {
          user_id: userId, name: parsed.name, category: parsed.category,
          catalog: parsed.catalogReference?.catalog ?? null,
          catalog_id: parsed.catalogReference?.id ?? null,
          quantity: 0, unit: parsed.quantity.unit, notes: parsed.notes,
        } });
        const plan = planStockChange({ ownerId: userId, stock: stockRecord(stock), kind: "receipt", quantity: parsed.quantity });
        await writeBalance(tx, userId, operationId, stock, plan, "receipt");
        return { stockId: stock.id, balance: plan.balance };
      });
  }

  async function changeStock(userId: number, operationKey: string, input: {
    stockId: string; kind: "receipt" | "manual_use" | "correction";
    quantity: Quantity; note?: string | null; expectedBalance?: Quantity | null;
  }): Promise<StockResult> {
    const parsed = z.object({
      stockId: uuid, kind: z.enum(["receipt", "manual_use", "correction"]),
      quantity: quantitySchema, note: z.string().max(5000).nullable().default(null),
      expectedBalance: quantitySchema.nullable().default(null),
    }).strict().parse(input);
    return operation(userId, operationKey, { kind: "change_stock", input: parsed },
      (result) => stockResultSchema.parse(result), async (tx, operationId) => {
        const stock = (await lockStock(tx, userId, [parsed.stockId])).get(parsed.stockId)!;
        if (stock.archived_at) throw new InventoryWriteError("STOCK_ARCHIVED");
        if ((parsed.kind === "correction" && !parsed.expectedBalance) ||
            (parsed.expectedBalance && convertQuantity(parsed.expectedBalance, stock.unit).value !== stock.quantity.toNumber())) {
          throw new InventoryWriteError("STALE_STOCK");
        }
        const plan = planStockChange({ ownerId: userId, stock: stockRecord(stock), ...parsed });
        await writeBalance(tx, userId, operationId, stock, plan, parsed.kind, null, parsed.note);
        return { stockId: stock.id, balance: plan.balance };
      });
  }

  /** Trusted server callback only: persist the full entry mutation (and derived
   * brew updates) using tx. entryMutation must contain the complete request for
   * retry fingerprinting. No network/provider work belongs in the callback.
   * This slice supports one confirmed ADDITION use per entry, keyed by entry ID.
   */
  async function mutateLinkedUsage(userId: number, operationKey: string, input: {
    brewId: string; entryId: string; kind: "create" | "edit" | "remove";
    stockId: string; quantity: Quantity | null;
    expected: { stockId: string; deducted: Quantity } | null;
    entryMutation: Prisma.InputJsonObject;
  }, writeEntry: (tx: Tx) => Promise<void>): Promise<UsageResult> {
    const parsed = z.object({
      brewId: uuid, entryId: uuid, kind: z.enum(["create", "edit", "remove"]),
      stockId: uuid, quantity: quantitySchema.nullable(),
      expected: z.object({ stockId: uuid, deducted: quantitySchema }).strict().nullable(),
      entryMutation: z.record(z.string(), z.json()),
    }).strict().parse(input);
    if ((parsed.kind === "remove") !== (parsed.quantity === null) ||
        (parsed.quantity && parsed.quantity.value <= 0) ||
        (parsed.kind === "create") !== (parsed.expected === null)) {
      throw new InventoryWriteError("ENTRY_MISMATCH");
    }
    return operation(userId, operationKey, { kind: "linked_usage", input: parsed },
      (result) => usageResultSchema.parse(result), async (tx, operationId) => {
        const brews = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM brews WHERE id = ${parsed.brewId}::uuid AND user_id = ${userId} FOR UPDATE
        `;
        if (!brews.length) throw new InventoryError("NOT_FOUND");
        await tx.$queryRaw`
          SELECT id FROM brew_entries WHERE id = ${parsed.entryId}::uuid
            AND brew_id = ${parsed.brewId}::uuid AND user_id = ${userId} FOR UPDATE
        `;
        const entry = await tx.brew_entries.findUnique({ where: { id: parsed.entryId } });
        if (parsed.kind === "create" ? entry !== null :
          !entry || entry.brew_id !== parsed.brewId || entry.user_id !== userId || entry.type !== "ADDITION") {
          throw new InventoryWriteError("ENTRY_MISMATCH");
        }
        const previous = await tx.inventory_consumptions.findUnique({
          where: { user_id_use_key: { user_id: userId, use_key: parsed.entryId } },
        });
        if (previous?.reversed_at) throw new InventoryWriteError("USAGE_REMOVED");
        if (previous && (previous.brew_id !== parsed.brewId || previous.entry_id !== parsed.entryId)) {
          throw new InventoryWriteError("ENTRY_MISMATCH");
        }
        if (parsed.expected ? !previous || previous.stock_id !== parsed.expected.stockId ||
          previous.unit !== parsed.expected.deducted.unit ||
          toQuantityTicks(previous.deducted.toNumber()) !== toQuantityTicks(parsed.expected.deducted.value)
          : previous !== null) {
          throw new InventoryWriteError("STALE_USAGE");
        }
        if (parsed.kind === "remove" && parsed.stockId !== previous!.stock_id) {
          throw new InventoryWriteError("ENTRY_MISMATCH");
        }
        const stocks = await lockStock(tx, userId, [parsed.stockId, ...(previous ? [previous.stock_id] : [])]);
        const nextStock = stocks.get(parsed.stockId)!;
        if ([...stocks.values()].some((stock) => stock.reconciliation_required)) {
          throw new InventoryWriteError("RECONCILIATION_REQUIRED");
        }
        if (parsed.quantity && nextStock.archived_at) throw new InventoryWriteError("STOCK_ARCHIVED");
        const oldLink: ConsumptionLink | null = previous ? {
          stockId: previous.stock_id, ownerId: userId, brewId: previous.brew_id,
          entryId: previous.entry_id, deducted: { value: previous.deducted.toNumber(), unit: previous.unit },
        } : null;
        const plans: Array<{ stock: inventory_stock; plan: ReturnType<typeof planConsumption>; kind: string }> = [];
        if (previous && previous.stock_id !== parsed.stockId) {
          const oldStock = stocks.get(previous.stock_id)!;
          plans.push({ stock: oldStock, kind: "usage_removal", plan: planConsumption({
            ownerId: userId, brew: { id: parsed.brewId, ownerId: userId }, entryId: parsed.entryId,
            stock: stockRecord(oldStock), previous: oldLink, usage: null,
          }) });
        }
        const plan = planConsumption({
          ownerId: userId, brew: { id: parsed.brewId, ownerId: userId }, entryId: parsed.entryId,
          stock: stockRecord(nextStock),
          previous: previous?.stock_id === parsed.stockId ? oldLink : null, usage: parsed.quantity,
        });
        plans.push({ stock: nextStock, plan,
          kind: parsed.kind === "remove" ? "usage_removal" : previous ? "usage_correction" : "brew_use" });

        await writeEntry(tx);
        const savedEntry = await tx.brew_entries.findUnique({ where: { id: parsed.entryId } });
        if (parsed.kind === "remove") {
          if (savedEntry) throw new InventoryWriteError("ENTRY_MISMATCH");
        } else {
          if (!savedEntry || savedEntry.brew_id !== parsed.brewId || savedEntry.user_id !== userId ||
              savedEntry.type !== "ADDITION" || !savedEntry.data || typeof savedEntry.data !== "object" ||
              Array.isArray(savedEntry.data)) throw new InventoryWriteError("ENTRY_MISMATCH");
          const actual = quantitySchema.parse({ value: savedEntry.data.amount, unit: normalizeQuantityUnit(savedEntry.data.unit) });
          const normalized = convertQuantity(actual, nextStock.unit);
          if (normalized.value !== plan.link!.deducted.value) throw new InventoryWriteError("ENTRY_MISMATCH");
        }
        const link = previous ? await tx.inventory_consumptions.update({
          where: { id: previous.id }, data: parsed.kind === "remove" ? { reversed_at: new Date() } : {
            stock_id: nextStock.id, deducted: plan.link!.deducted.value, unit: nextStock.unit,
          },
        }) : await tx.inventory_consumptions.create({ data: {
          user_id: userId, stock_id: nextStock.id, brew_id: parsed.brewId, entry_id: parsed.entryId,
          use_key: parsed.entryId, deducted: plan.link!.deducted.value, unit: nextStock.unit,
        } });
        for (const movement of plans) {
          await writeBalance(tx, userId, operationId, movement.stock, movement.plan, movement.kind, link.id);
        }
        return { entryId: parsed.entryId, removed: parsed.kind === "remove",
          balances: plans.map((movement) => ({ stockId: movement.stock.id, balance: movement.plan.balance })) };
      });
  }

  /** The legacy/free path shares the same locks, so it cannot race a deduction
   * or bypass correction rules for an already linked use. */
  async function mutateUntrackedEntry(userId: number, input: {
    brewId: string; entryId: string; kind: "create" | "edit" | "remove";
    entryMutation: Prisma.InputJsonObject;
  }, writeEntry: (tx: Tx) => Promise<void>): Promise<{
    status: "untracked" | "deducted" | "premium_unavailable" | "reconciliation_required";
  }> {
    uuid.parse(input.brewId);
    uuid.parse(input.entryId);
    return database.$transaction(async (tx) => {
      const owners = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM users WHERE id = ${userId} FOR UPDATE
      `;
      if (!owners.length) throw new InventoryError("NOT_FOUND");
      const status = await getPremiumAccessStatus(userId, new Date(), tx);
      if (!status.activeUser) throw new InventoryError("NOT_FOUND");
      const brews = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM brews WHERE id = ${input.brewId}::uuid AND user_id = ${userId} FOR UPDATE
      `;
      if (!brews.length) throw new InventoryError("NOT_FOUND");
      await tx.$queryRaw`
        SELECT id FROM brew_entries WHERE id = ${input.entryId}::uuid
          AND brew_id = ${input.brewId}::uuid AND user_id = ${userId} FOR UPDATE
      `;
      const link = await tx.inventory_consumptions.findUnique({
        where: { user_id_use_key: { user_id: userId, use_key: input.entryId } },
      });
      if (link && (link.brew_id !== input.brewId || link.entry_id !== input.entryId)) {
        throw new InventoryError("NOT_FOUND");
      }
      if (link?.reversed_at) throw new InventoryWriteError("USAGE_REMOVED");
      if (link && input.kind === "create") {
        const entry = await tx.brew_entries.findFirst({
          where: { id: input.entryId, brew_id: input.brewId, user_id: userId }, select: { id: true },
        });
        if (!entry) throw new InventoryWriteError("USAGE_REMOVED");
      }
      const affectsUsage = input.kind === "remove" ||
        (input.kind === "edit" && Object.hasOwn(input.entryMutation, "data"));
      if (link && affectsUsage && status.premiumEnabled) throw new InventoryWriteError("SELECTION_REQUIRED");
      if (link && affectsUsage) {
        await tx.inventory_stock.update({ where: { id: link.stock_id }, data: { reconciliation_required: true } });
      }
      await writeEntry(tx);
      return { status: link && affectsUsage ? "reconciliation_required" : link ? "deducted" :
        status.premiumEnabled ? "untracked" : "premium_unavailable" };
    }, { maxWait: 10_000, timeout: 15_000 });
  }

  return { createStock, changeStock, mutateLinkedUsage, mutateUntrackedEntry };
}
