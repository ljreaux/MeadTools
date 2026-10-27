import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  bottlingSelectionSchema,
  productionBottleRows,
  validateBottlingOutputs,
  productionDifference,
  toQuantityTicks,
  InventoryError,
  type BottlingSelection,
} from "@meadtools/inventory-domain";
import {
  InventoryWriteError,
  writeInventoryBalance,
  createInventoryOperation,
} from "./inventory";
import { ownedStorageStock, replaceStorage } from "./inventory-storage";
import prisma from "@/lib/prisma";
import {
  acknowledgeBottlingChangeRequestBodySchema,
  inventoryOrganizationMutationResponseSchema,
} from "@meadtools/api-contract/inventory";
import { getPremiumAccessStatus } from "./premium-access";

type Tx = Prisma.TransactionClient;
type Bottling = Prisma.inventory_bottlingsGetPayload<{
  include: { outputs: true };
}>;
export function bottlingRevision(row: Bottling) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: row.id,
        version: row.version,
        pending: row.reconciliation_required,
        removed: row.removed_at,
        source: row.source_snapshot,
        outputs: [...row.outputs]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((row) => [row.row_id, row.stock_id, row.quantity]),
      }),
    )
    .digest("hex");
}
export async function readBottlings(tx: Tx, userId: number, brewId: string) {
  const rows = await tx.inventory_bottlings.findMany({
    where: { user_id: userId, brew_id: brewId, removed_at: null },
    include: { outputs: { include: { stock: { include: { mead: true } } } } },
  });
  return rows.map((row) => ({
    entry_id: row.entry_id,
    revision: bottlingRevision(row),
    reconciliation_required: row.reconciliation_required,
    source_name: row.source_name,
    outputs: row.outputs.map((output) => ({
      row_id: output.row_id,
      stock_id: output.stock_id,
      mead_id: output.stock.mead_id!,
      name: output.stock.mead?.name ?? output.stock.name,
      quantity: output.quantity,
      size_liters: output.stock.bottle_size_liters!.toNumber(),
    })),
  }));
}
export async function guardBottlingMutation(
  tx: Tx,
  userId: number,
  entryId: string,
  affects: boolean,
) {
  if (!affects) return;
  const previous = await tx.inventory_bottlings.findUnique({
    where: { entry_id: entryId },
    include: { outputs: true },
  });
  if (!previous || previous.user_id !== userId || previous.removed_at) return;
  const access = await getPremiumAccessStatus(userId, new Date(), tx);
  if (access.premiumEnabled)
    throw new InventoryWriteError("SELECTION_REQUIRED");
  await tx.inventory_bottlings.update({
    where: { id: previous.id },
    data: { reconciliation_required: true, version: { increment: 1 } },
  });
  await tx.inventory_stock.updateMany({
    where: {
      id: { in: previous.outputs.map((row) => row.stock_id) },
      user_id: userId,
    },
    data: { reconciliation_required: true },
  });
  return true;
}
/** Atomically update the packaging-associated yield record, never nominal bottle capacity. */
export async function syncBottlingVolume(
  tx: Tx,
  userId: number,
  brewId: string,
  entryId: string,
  remove = false,
) {
  const existing = await tx.brew_entries.findFirst({
    where: {
      brew_id: brewId,
      user_id: userId,
      type: "VOLUME",
      data: { path: ["packagingEntryId"], equals: entryId },
    },
  });
  const source = await tx.brew_entries.findFirst({
    where: { id: entryId, brew_id: brewId, user_id: userId, type: "PACKAGING" },
  });
  if (remove || !source) {
    if (existing) await tx.brew_entries.delete({ where: { id: existing.id } });
  } else {
    const data = source.data as { packagedVolumeLiters?: number };
    if (
      !Number.isFinite(data?.packagedVolumeLiters) ||
      data.packagedVolumeLiters! <= 0 ||
      data.packagedVolumeLiters! > 1_000_000_000
    )
      throw new InventoryError("INVALID_QUANTITY");
    const value = {
      datetime: source.datetime,
      title: "Packaged volume",
      data: { liters: data.packagedVolumeLiters!, packagingEntryId: entryId },
    };
    if (existing)
      await tx.brew_entries.update({ where: { id: existing.id }, data: value });
    else
      await tx.brew_entries.create({
        data: { ...value, brew_id: brewId, user_id: userId, type: "VOLUME" },
      });
  }
  const latest = await tx.brew_entries.findFirst({
    where: { brew_id: brewId, type: "VOLUME" },
    orderBy: [{ datetime: "desc" }, { id: "desc" }],
  });
  const liters = (latest?.data as { liters?: number } | null)?.liters;
  await tx.brews.update({
    where: { id: brewId },
    data: { current_volume_liters: typeof liters === "number" ? liters : null },
  });
}
export async function applyBottling(
  tx: Tx,
  userId: number,
  operationId: string,
  input: {
    brewId: string;
    entryId: string;
    kind: "create" | "edit" | "remove";
    entryMutation: Prisma.InputJsonObject;
  },
  selection: BottlingSelection,
  writeEntry: (tx: Tx) => Promise<void>,
) {
  const parsed = bottlingSelectionSchema.parse(selection);
  const brew = await tx.brews.findFirst({
    where: { id: input.brewId, user_id: userId },
  });
  if (!brew) throw new InventoryError("NOT_FOUND");
  const entry = await tx.brew_entries.findFirst({
    where: { id: input.entryId, brew_id: input.brewId, user_id: userId },
  });
  const previous = await tx.inventory_bottlings.findUnique({
    where: { entry_id: input.entryId },
    include: { outputs: true },
  });
  if (
    previous &&
    (previous.user_id !== userId || previous.brew_id !== input.brewId)
  )
    throw new InventoryError("NOT_FOUND");
  if (previous?.removed_at || (input.kind === "create" ? !!entry : !entry))
    throw new InventoryWriteError("ENTRY_MISMATCH");
  if ((entry?.type ?? input.entryMutation.type) !== "PACKAGING")
    throw new InventoryWriteError("ENTRY_MISMATCH");
  if (
    (previous ? bottlingRevision(previous) : null) !== parsed.expected_revision
  )
    throw new InventoryWriteError("STALE_USAGE");
  if (previous?.reconciliation_required && parsed.mode !== "reconcile")
    throw new InventoryWriteError("RECONCILIATION_REQUIRED");
  if (
    (parsed.mode === "reconcile" ||
      (!previous?.outputs.length &&
        input.kind === "edit" &&
        parsed.outputs.length > 0)) &&
    !parsed.confirmed_on_hand
  )
    throw new InventoryWriteError("RECONCILIATION_REQUIRED");
  const data = input.entryMutation.data ?? entry?.data;
  const rows = input.kind === "remove" ? [] : productionBottleRows(data);
  validateBottlingOutputs(rows, parsed.outputs);
  if (
    parsed.mode === "reconcile" &&
    parsed.outputs.some((output) => output.target.kind === "new")
  )
    throw new InventoryWriteError("RECONCILIATION_REQUIRED");
  const sourceRecord =
    previous ??
    (await tx.inventory_bottlings.create({
      data: {
        user_id: userId,
        brew_id: input.brewId,
        entry_id: input.entryId,
        source_name: (brew.name?.trim() || "Bottling").slice(0, 200),
        source_snapshot: JSON.parse(
          JSON.stringify(data ?? {}),
        ) as Prisma.InputJsonObject,
      },
    }));
  const createdMeads = new Set<string>();
  const desired = new Map<
    string,
    { row_id: string; stock_id: string; quantity: number }
  >();
  const placements = new Map<
    string,
    Array<{ location_id: string; position: string; quantity: number }>
  >();
  for (const output of parsed.outputs) {
    const row = rows.find((row) => row.id === output.row_id)!;
    let mead = await tx.inventory_meads.findFirst({
      where: { id: output.target.mead_id, user_id: userId },
    });
    if (
      output.target.kind === "new" &&
      mead &&
      (!createdMeads.has(mead.id) || mead.name !== output.target.name)
    )
      throw new InventoryWriteError("ENTRY_MISMATCH");
    if (!mead && output.target.kind === "new") {
      if (
        await tx.inventory_meads.count({ where: { id: output.target.mead_id } })
      )
        throw new InventoryError("NOT_FOUND");
      mead = await tx.inventory_meads.create({
        data: {
          id: output.target.mead_id,
          user_id: userId,
          name: output.target.name,
        },
      });
      createdMeads.add(mead.id);
    }
    if (!mead || mead.archived_at) throw new InventoryError("NOT_FOUND");
    let stock = await tx.inventory_stock.findFirst({
      where: {
        mead_id: mead.id,
        bottle_size_liters: row.sizeLiters,
        user_id: userId,
      },
    });
    if (!stock) {
      if (parsed.mode === "reconcile")
        throw new InventoryWriteError("RECONCILIATION_REQUIRED");
      if (
        (await tx.inventory_stock.count({ where: { mead_id: mead.id } })) >= 50
      )
        throw new InventoryError("INVALID_QUANTITY");
      stock = await tx.inventory_stock.create({
        data: {
          user_id: userId,
          mead_id: mead.id,
          name: mead.name,
          category: "mead",
          bottle_size_liters: row.sizeLiters,
          quantity: 0,
          unit: "units",
        },
      });
    }
    if (stock.archived_at) throw new InventoryWriteError("STOCK_ARCHIVED");
    const key = JSON.stringify([row.id, stock.id]),
      prior = desired.get(key);
    desired.set(key, {
      row_id: row.id,
      stock_id: stock.id,
      quantity: (prior?.quantity ?? 0) + output.quantity,
    });
    if (output.location_id) {
      if (
        !(await tx.inventory_locations.count({
          where: { id: output.location_id, user_id: userId, archived_at: null },
        }))
      )
        throw new InventoryError("NOT_FOUND");
      if (!placements.has(stock.id)) placements.set(stock.id, []);
      placements.get(stock.id)!.push({
        location_id: output.location_id,
        position: output.position,
        quantity: output.quantity,
      });
    }
  }
  const total = (
    outputs: readonly { stock_id: string; quantity: number }[],
  ) => {
    const map = new Map<string, number>();
    for (const row of outputs)
      map.set(row.stock_id, (map.get(row.stock_id) ?? 0) + row.quantity);
    return map;
  };
  const old = total(previous?.outputs ?? []),
    next = total([...desired.values()]);
  for (const id of new Set([...old.keys(), ...next.keys()])) {
    const stock = await ownedStorageStock(tx, userId, id);
    // Reconciliation rebases produced counts, not on-hand counts. Production
    // can exceed the remaining balance because bottles may already be used.
    if (parsed.mode !== "reconcile") {
      if (stock.reconciliation_required)
        throw new InventoryWriteError("RECONCILIATION_REQUIRED");
      const plan = productionDifference(
        stock.quantity.toNumber(),
        old.get(id) ?? 0,
        next.get(id) ?? 0,
      );
      const allocated = stock.allocations.reduce(
        (sum, row) => sum + toQuantityTicks(row.quantity.toNumber()),
        0,
      );
      if (toQuantityTicks(plan.balance.value) < allocated)
        throw new InventoryWriteError("STORAGE_IN_USE");
      await writeInventoryBalance(
        tx,
        userId,
        operationId,
        stock,
        plan,
        previous ? "bottling_correction" : "bottling_output",
        null,
        sourceRecord.source_name,
        undefined,
        sourceRecord.id,
      );
      const places = placements.get(id) ?? [];
      const placed = places.reduce((sum, row) => sum + row.quantity, 0);
      // Placement is only for newly added bottles; existing bottles retain later moves.
      if (placed && plan.adjustment > 0) {
        let remainingAdded = plan.adjustment;
        const current = await ownedStorageStock(tx, userId, id);
        const allocations = current.allocations.map((row) => ({
          location_id: row.location_id,
          position: row.position,
          quantity: row.quantity.toNumber(),
        }));
        for (const place of places) {
          const quantity = Math.min(remainingAdded, place.quantity);
          remainingAdded -= quantity;
          if (!quantity) continue;
          const found = allocations.find(
            (row) =>
              row.location_id === place.location_id &&
              row.position === place.position,
          );
          if (found) found.quantity += quantity;
          else allocations.push({ ...place, quantity });
        }
        await replaceStorage(tx, userId, operationId, current, allocations);
      }
    }
    await tx.inventory_meads.update({
      where: { id: stock.mead_id! },
      data: { version: { increment: 1 } },
    });
  }
  await writeEntry(tx);
  await syncBottlingVolume(
    tx,
    userId,
    input.brewId,
    input.entryId,
    input.kind === "remove",
  );
  const savedSource =
    input.kind === "remove"
      ? entry
      : await tx.brew_entries.findUnique({ where: { id: input.entryId } });
  const value = {
    source_snapshot: JSON.parse(
      JSON.stringify({
        packaging: savedSource?.data ?? data ?? {},
        datetime: savedSource?.datetime ?? entry?.datetime ?? null,
        note: savedSource ? savedSource.note : entry?.note ?? null,
      }),
    ) as Prisma.InputJsonObject,
    reconciliation_required: false,
    version: { increment: 1 },
    removed_at: input.kind === "remove" ? new Date() : null,
  };
  const record = await tx.inventory_bottlings.update({
    where: { id: sourceRecord.id },
    data: value,
  });
  await tx.inventory_productions.deleteMany({
    where: { bottling_id: record.id, user_id: userId },
  });
  if (desired.size)
    await tx.inventory_productions.createMany({
      data: [...desired.values()].map((row) => ({
        ...row,
        user_id: userId,
        bottling_id: record.id,
      })),
    });
  if (parsed.mode === "reconcile")
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      const pending = await tx.inventory_productions.count({
        where: {
          stock_id: id,
          user_id: userId,
          bottling: { reconciliation_required: true },
        },
      });
      await tx.inventory_stock.update({
        where: { id },
        data: { reconciliation_required: pending > 0 },
      });
    }
}

export async function readBottlingChanges(tx: Tx, userId: number) {
  const rows = await tx.inventory_bottlings.findMany({
    where: { user_id: userId, reconciliation_required: true },
    include: { outputs: true },
  });
  const entries = await tx.brew_entries.findMany({
    where: { id: { in: rows.map((row) => row.entry_id) }, user_id: userId },
    select: { id: true },
  });
  return rows.map((row) => ({
    id: row.id,
    brew_id: row.brew_id,
    source_name: row.source_name,
    revision: bottlingRevision(row),
    stock_ids: row.outputs.map((output) => output.stock_id),
    source_missing: !entries.some((entry) => entry.id === row.entry_id),
  }));
}

/** A removed source cannot replay production. The owner explicitly reviews physical
 * counts in Inventory first, then closes the retained source warning without a receipt. */
export async function acknowledgeBottlingChange(
  userId: number,
  id: string,
  input: unknown,
) {
  const parsed = acknowledgeBottlingChangeRequestBodySchema.parse(input);
  return createInventoryOperation(prisma)(
    userId,
    parsed.operation_id,
    { kind: "acknowledge_bottling_change", id, input: parsed },
    (value) => inventoryOrganizationMutationResponseSchema.parse(value),
    async (tx) => {
      const row = await tx.inventory_bottlings.findFirst({
        where: { id, user_id: userId },
        include: { outputs: true },
      });
      if (!row) throw new InventoryError("NOT_FOUND");
      if (bottlingRevision(row) !== parsed.expected_revision)
        throw new InventoryWriteError("STALE_USAGE");
      if (
        !row.reconciliation_required ||
        (await tx.brew_entries.count({
          where: { id: row.entry_id, user_id: userId },
        }))
      )
        throw new InventoryWriteError("RECONCILIATION_REQUIRED");
      await tx.inventory_bottlings.update({
        where: { id },
        data: {
          removed_at: new Date(),
          reconciliation_required: false,
          version: { increment: 1 },
        },
      });
      for (const stockId of new Set(
        row.outputs.map((output) => output.stock_id),
      )) {
        const pending = await tx.inventory_productions.count({
          where: {
            stock_id: stockId,
            user_id: userId,
            bottling: { reconciliation_required: true },
          },
        });
        await tx.inventory_stock.update({
          where: { id: stockId },
          data: { reconciliation_required: pending > 0 },
        });
      }
      return { id };
    },
  );
}
