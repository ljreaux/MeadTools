import { storedBottleDisplaySize } from "./inventory-bottle-size";
import "server-only";
import { createHash } from "node:crypto";
import type { Prisma, inventory_stock } from "@prisma/client";
import {
  inventoryLocationPaths,
  planStorageReduction,
  validateAllocationTotal,
  validateStockQuantity,
  InventoryError,
  toQuantityTicks,
  fromQuantityTicks,
} from "@meadtools/inventory-domain";
import type { InventoryStorageSource } from "@meadtools/api-contract/contracts";

type Tx = Prisma.TransactionClient;
type StockWithStorage = Prisma.inventory_stockGetPayload<{
  include: { allocations: true };
}>;
export function organizedStock(row: StockWithStorage) {
  const allocations = row.allocations
    .map((allocation) => ({
      location_id: allocation.location_id,
      position: allocation.position,
      quantity: allocation.quantity.toNumber(),
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const quantity = { value: row.quantity.toNumber(), unit: row.unit };
  const revision = createHash("sha256")
    .update(
      JSON.stringify({
        id: row.id,
        version: row.storage_version,
        quantity,
        allocations,
      }),
    )
    .digest("hex");
  return {
    id: row.id,
    name: row.name,
    mead_id: row.mead_id,
    bottle_size_liters: row.bottle_size_liters?.toNumber() ?? null,
    display_size: storedBottleDisplaySize(row),
    quantity,
    revision,
    allocations,
  };
}
export async function ownedStorageStock(tx: Tx, userId: number, id: string) {
  const stock = await tx.inventory_stock.findFirst({
    where: { id, user_id: userId },
    include: { allocations: true },
  });
  if (!stock) throw new InventoryError("NOT_FOUND");
  return stock;
}
async function record(
  tx: Tx,
  userId: number,
  operationId: string,
  stock: inventory_stock,
  path: string,
  position: string,
  delta: number,
  balance: number,
  reason: string,
) {
  if (!delta) return;
  await tx.inventory_storage_events.create({
    data: {
      user_id: userId,
      stock_id: stock.id,
      operation_id: operationId,
      unit: stock.unit,
      location_path: path,
      position,
      delta,
      balance_after: balance,
      reason,
    },
  });
}

/** Every quantity writer calls this in its existing account-serialized operation.
 * Receipts remain unlocated. Uses draw unlocated stock first, then path/position
 * order; every affected position gets its own retained movement record. */
export async function reduceStorageForBalance(
  tx: Tx,
  userId: number,
  operationId: string,
  stockId: string,
  balance: number,
  reason: string,
  source?: InventoryStorageSource,
) {
  const stock = await ownedStorageStock(tx, userId, stockId);
  if (source !== undefined) {
    const used =
      toQuantityTicks(stock.quantity.toNumber()) - toQuantityTicks(balance);
    if (used < 0 || reason !== "manual_use")
      throw new InventoryError("LINK_MISMATCH");
    if (source === "unlocated") {
      const unlocated = validateAllocationTotal(
        { value: stock.quantity.toNumber(), unit: stock.unit },
        stock.allocations.map((row) => row.quantity.toNumber()),
      );
      if (toQuantityTicks(unlocated) < used)
        throw new InventoryError("INSUFFICIENT_STOCK", {
          shortage: (used - toQuantityTicks(unlocated)) / 1e6,
          unit: stock.unit,
        });
      return;
    }
    const allocation = stock.allocations.find(
      (row) =>
        row.location_id === source.location_id &&
        row.position === source.position,
    );
    if (!allocation) throw new InventoryError("NOT_FOUND");
    const available = toQuantityTicks(allocation.quantity.toNumber());
    if (available < used)
      throw new InventoryError("INSUFFICIENT_STOCK", {
        shortage: (used - available) / 1e6,
        unit: stock.unit,
      });
    const locations = await tx.inventory_locations.findMany({
      where: { user_id: userId },
    });
    const path = inventoryLocationPaths(locations).get(allocation.location_id)!;
    const remaining = fromQuantityTicks(available - used);
    if (remaining)
      await tx.inventory_allocations.update({
        where: { id: allocation.id },
        data: { quantity: remaining },
      });
    else
      await tx.inventory_allocations.delete({ where: { id: allocation.id } });
    await record(
      tx,
      userId,
      operationId,
      stock,
      path,
      allocation.position,
      -used / 1e6,
      remaining,
      reason,
    );
    return;
  }
  if (!stock.allocations.length) return;
  const locations = await tx.inventory_locations.findMany({
    where: { user_id: userId },
  });
  const paths = inventoryLocationPaths(locations);
  const allocations = [...stock.allocations].sort(
    (a, b) =>
      `${paths.get(a.location_id)}\n${a.position}`.localeCompare(
        `${paths.get(b.location_id)}\n${b.position}`,
        "en",
        { numeric: true },
      ) || a.id.localeCompare(b.id),
  );
  const changes = planStorageReduction(
    balance,
    allocations.map((row) => ({
      id: row.id,
      quantity: row.quantity.toNumber(),
    })),
  );
  for (const change of changes) {
    const allocation = allocations.find((row) => row.id === change.id)!;
    if (change.quantity)
      await tx.inventory_allocations.update({
        where: { id: change.id },
        data: { quantity: change.quantity },
      });
    else await tx.inventory_allocations.delete({ where: { id: change.id } });
    await record(
      tx,
      userId,
      operationId,
      stock,
      paths.get(allocation.location_id)!,
      allocation.position,
      -change.removed,
      change.quantity,
      reason,
    );
  }
}

export async function replaceStorage(
  tx: Tx,
  userId: number,
  operationId: string,
  stock: StockWithStorage,
  desired: readonly {
    location_id: string;
    position: string;
    quantity: number;
  }[],
) {
  validateAllocationTotal(
    { value: stock.quantity.toNumber(), unit: stock.unit },
    desired.map((row) => row.quantity),
  );
  for (const row of desired)
    validateStockQuantity(
      stock.category === "mead" ? "packaging" : stock.category,
      { value: row.quantity, unit: stock.unit },
    );
  const locations = await tx.inventory_locations.findMany({
    where: { user_id: userId, archived_at: null },
  });
  const paths = inventoryLocationPaths(locations);
  if (desired.some((row) => !paths.has(row.location_id)))
    throw new InventoryError("NOT_FOUND");
  const key = (row: { location_id: string; position: string }) =>
    JSON.stringify([row.location_id, row.position]);
  const next = new Map(
    desired.filter((row) => row.quantity > 0).map((row) => [key(row), row]),
  );
  for (const allocation of stock.allocations) {
    const replacement = next.get(key(allocation));
    const quantity = replacement?.quantity ?? 0;
    const delta =
      Math.round((quantity - allocation.quantity.toNumber()) * 1e6) / 1e6;
    if (quantity)
      await tx.inventory_allocations.update({
        where: { id: allocation.id },
        data: { quantity },
      });
    else
      await tx.inventory_allocations.delete({ where: { id: allocation.id } });
    await record(
      tx,
      userId,
      operationId,
      stock,
      paths.get(allocation.location_id)!,
      allocation.position,
      delta,
      quantity,
      "move",
    );
    next.delete(key(allocation));
  }
  for (const allocation of next.values()) {
    await tx.inventory_allocations.create({
      data: {
        ...allocation,
        user_id: userId,
        stock_id: stock.id,
        unit: stock.unit,
      },
    });
    await record(
      tx,
      userId,
      operationId,
      stock,
      paths.get(allocation.location_id)!,
      allocation.position,
      allocation.quantity,
      allocation.quantity,
      "move",
    );
  }
  await tx.inventory_stock.update({
    where: { id: stock.id },
    data: { storage_version: { increment: 1 } },
  });
}
