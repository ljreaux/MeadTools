import "server-only";

import type { Prisma } from "@prisma/client";
import type { BrewInventoryOutcome, BrewInventorySelection } from "@meadtools/api-contract/contracts";
import { normalizeQuantityUnit, quantitySchema } from "@meadtools/inventory-domain";
import { createInventoryService, InventoryWriteError } from "@/lib/db/inventory";

const inventory = createInventoryService();

/** Called by every entry mutation, including requests from older/free clients. */
export async function mutateBrewEntryWithInventory(userId: number, input: {
  brewId: string; entryId: string; kind: "create" | "edit" | "remove";
  selection?: BrewInventorySelection;
  entryMutation: Prisma.InputJsonObject;
}, writeEntry: (tx: Prisma.TransactionClient) => Promise<void>): Promise<BrewInventoryOutcome> {
  if (input.selection?.mode !== "deduct") {
    return inventory.mutateUntrackedEntry(userId, input, writeEntry);
  }
  if (input.kind === "create" && input.entryMutation.type !== "ADDITION") {
    throw new InventoryWriteError("ENTRY_MISMATCH");
  }
  const data = input.entryMutation.data;
  if (input.kind !== "remove" && (!data || typeof data !== "object" || Array.isArray(data))) {
    throw new InventoryWriteError("ENTRY_MISMATCH");
  }
  const addition = data as Prisma.InputJsonObject;
  const quantity = input.kind === "remove" ? null : quantitySchema.parse({
    value: addition.amount, unit: normalizeQuantityUnit(addition.unit),
  });
  const result = await inventory.mutateLinkedUsage(userId, input.selection.operation_id, {
    brewId: input.brewId, entryId: input.entryId, kind: input.kind,
    stockId: input.selection.stock_id, quantity,
    expected: input.selection.expected ? {
      stockId: input.selection.expected.stock_id, deducted: input.selection.expected.deducted,
    } : null,
    entryMutation: input.entryMutation,
  }, writeEntry);
  return { status: "deducted", balances: result.balances.map((item) => ({ stock_id: item.stockId, quantity: item.balance })) };
}
