import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  inventoryEntryLines,
  planEntryInventory,
  toQuantityTicks,
  InventoryError,
  type InventoryUse,
} from "@meadtools/inventory-domain";
import { InventoryWriteError } from "./inventory";
import type { BrewInventoryItems } from "@meadtools/api-contract/contracts";

type Mutation = {
  brewId: string;
  entryId: string;
  kind: "create" | "edit" | "remove";
  entryMutation: Prisma.InputJsonObject;
};
/** Called only inside an account-serialized inventory operation, including a whole batch. */
export async function applyEntryInventoryLines(
  tx: Prisma.TransactionClient,
  userId: number,
  operationId: string,
  input: Mutation,
  selection: BrewInventoryItems,
  writeEntry: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  const brew = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT id FROM brews WHERE id=${input.brewId}::uuid AND user_id=${userId} FOR UPDATE`;
  if (!brew.length) throw new InventoryError("NOT_FOUND");
  const existing = await tx.brew_entries.findFirst({
    where: { id: input.entryId, brew_id: input.brewId, user_id: userId },
  });
  const previous = await tx.inventory_consumptions.findMany({
    where: { user_id: userId, entry_id: input.entryId },
  });
  if (previous.some((use) => use.brew_id !== input.brewId))
    throw new InventoryWriteError("ENTRY_MISMATCH");
  if (input.kind === "create" && (existing || previous.length))
    throw new InventoryWriteError(
      previous.some((use) => use.reversed_at)
        ? "USAGE_REMOVED"
        : "ENTRY_MISMATCH",
    );
  if (input.kind !== "create" && !existing)
    throw new InventoryWriteError(
      previous.length ? "USAGE_REMOVED" : "ENTRY_MISMATCH",
    );
  const type =
    input.kind === "create" ? String(input.entryMutation.type) : existing!.type;
  if (type !== "ADDITION" && type !== "PACKAGING")
    throw new InventoryWriteError("ENTRY_MISMATCH");
  const active = previous.filter((use) => !use.reversed_at);
  const actual: InventoryUse[] = active.map((use) => ({
    line_key: use.line_key,
    stock_id: use.stock_id,
    deducted: { value: use.deducted.toNumber(), unit: use.unit },
  }));
  const snapshot = (uses: InventoryUse[]) =>
    JSON.stringify(
      uses
        .map((use) => [
          use.line_key,
          use.stock_id,
          use.deducted.unit,
          toQuantityTicks(use.deducted.value),
        ])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  if (snapshot(selection.expected) !== snapshot(actual))
    throw new InventoryWriteError("STALE_USAGE");
  const data = input.entryMutation.data;
  const lines = input.kind === "remove" ? [] : inventoryEntryLines(type, data);
  const keys = lines.map((line) => line.key).sort();
  const supplied = selection.items.map((item) => item.line_key).sort();
  if (
    new Set(supplied).size !== supplied.length ||
    JSON.stringify(keys) !== JSON.stringify(supplied)
  )
    throw new InventoryWriteError("ENTRY_MISMATCH");
  if (
    input.kind === "edit" &&
    !previous.length &&
    selection.items.some((item) => item.stock_id)
  )
    throw new InventoryWriteError("ENTRY_MISMATCH");
  if (
    active.some((use) =>
      selection.items.some(
        (item) => item.line_key === use.line_key && !item.stock_id,
      ),
    )
  )
    throw new InventoryWriteError("SELECTION_REQUIRED");
  const ids = Array.from(
    new Set([
      ...active.map((use) => use.stock_id),
      ...selection.items.flatMap((item) =>
        item.stock_id ? [item.stock_id] : [],
      ),
    ]),
  );
  const stocks = ids.length
    ? await tx.inventory_stock.findMany({
        where: { id: { in: ids }, user_id: userId },
      })
    : [];
  if (stocks.length !== ids.length) throw new InventoryError("NOT_FOUND");
  if (stocks.some((stock) => stock.reconciliation_required))
    throw new InventoryWriteError("RECONCILIATION_REQUIRED");
  if (
    stocks.some(
      (stock) =>
        stock.archived_at &&
        selection.items.some((item) => item.stock_id === stock.id),
    )
  )
    throw new InventoryWriteError("STOCK_ARCHIVED");
  const plan = planEntryInventory({
    stocks: stocks.map((stock) => ({
      id: stock.id,
      category: stock.category,
      quantity: { value: stock.quantity.toNumber(), unit: stock.unit },
    })),
    lines,
    bindings: selection.items,
    previous: actual,
  });
  await writeEntry(tx);
  const saved = await tx.brew_entries.findUnique({
    where: { id: input.entryId },
  });
  if (
    input.kind === "remove"
      ? saved !== null
      : !saved ||
        saved.user_id !== userId ||
        saved.brew_id !== input.brewId ||
        saved.type !== type ||
        JSON.stringify(inventoryEntryLines(saved.type, saved.data)) !==
          JSON.stringify(lines)
  )
    throw new InventoryWriteError("ENTRY_MISMATCH");
  const changed = new Map<string, Set<string>>();
  for (const use of active) {
    if (!changed.has(use.stock_id)) changed.set(use.stock_id, new Set());
    changed.get(use.stock_id)!.add(use.id);
  }
  for (const prior of active)
    if (!plan.uses.some((use) => use.line_key === prior.line_key))
      await tx.inventory_consumptions.update({
        where: { id: prior.id },
        data: { reversed_at: new Date() },
      });
  for (const use of plan.uses) {
    const prior = previous.find((item) => item.line_key === use.line_key);
    const value = {
      stock_id: use.stock_id,
      deducted: use.deducted.value,
      unit: use.deducted.unit,
      reversed_at: null,
    };
    const link = prior
      ? await tx.inventory_consumptions.update({
          where: { id: prior.id },
          data: value,
        })
      : await tx.inventory_consumptions.create({
          data: {
            ...value,
            user_id: userId,
            brew_id: input.brewId,
            entry_id: input.entryId,
            line_key: use.line_key,
            use_key: use.line_key === "addition" ? input.entryId : randomUUID(),
          },
        });
    if (!changed.has(use.stock_id)) changed.set(use.stock_id, new Set());
    changed.get(use.stock_id)!.add(link.id);
  }
  for (const balance of plan.balances) {
    if (balance.adjustment === 0) continue;
    await tx.inventory_stock.update({
      where: { id: balance.stock_id },
      data: { quantity: balance.quantity.value },
    });
    const links = Array.from(changed.get(balance.stock_id) ?? []);
    const adjustment = {
      user_id: userId,
      stock_id: balance.stock_id,
      operation_id: operationId,
      consumption_id: links.length === 1 ? links[0] : null,
      kind:
        input.kind === "remove"
          ? "usage_removal"
          : input.kind === "edit"
            ? "usage_correction"
            : "brew_use",
      delta: balance.adjustment,
      balance_after: balance.quantity.value,
      unit: balance.quantity.unit,
    };
    await tx.inventory_adjustments.upsert({
      where: {
        operation_id_stock_id: {
          operation_id: operationId,
          stock_id: balance.stock_id,
        },
      },
      create: adjustment,
      update: {
        delta: { increment: balance.adjustment },
        balance_after: balance.quantity.value,
        consumption_id: null,
      },
    });
  }
  return {
    status:
      plan.uses.length || active.length
        ? ("deducted" as const)
        : ("untracked" as const),
    balances: plan.balances.map(({ stock_id, quantity }) => ({
      stock_id,
      quantity,
    })),
  };
}
