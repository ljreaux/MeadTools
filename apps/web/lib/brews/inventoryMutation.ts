import "server-only";

import { applyEntryInventoryLines } from "@/lib/db/inventory-lines";
import { createInventoryOperation } from "@/lib/db/inventory";
import {
  brewInventoryOutcomeSchema,
  brewInventoryItemsSchema,
} from "@meadtools/api-contract/brews";
import type { Prisma } from "@prisma/client";
import type {
  BrewInventoryOutcome,
  BrewInventorySelection,
} from "@meadtools/api-contract/contracts";
import { additionInventoryQuantity } from "@meadtools/inventory-domain";
import {
  createInventoryService,
  InventoryWriteError,
} from "@/lib/db/inventory";

import { applyBottling, guardBottlingMutation } from "@/lib/db/bottling";
import {
  bottlingSelectionSchema,
  type BottlingSelection,
} from "@meadtools/inventory-domain";

const inventory = createInventoryService();

/** Called by every entry mutation, including requests from older/free clients. */
export async function mutateBrewEntryWithInventory(
  userId: number,
  input: {
    brewId: string;
    entryId: string;
    kind: "create" | "edit" | "remove";
    selection?: BrewInventorySelection;
    bottling?: BottlingSelection;
    entryMutation: Prisma.InputJsonObject;
  },
  writeEntry: (tx: Prisma.TransactionClient) => Promise<void>,
  afterBottlingVolume?: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<BrewInventoryOutcome> {
  if (input.bottling) {
    const selection = bottlingSelectionSchema.parse(input.bottling);
    return createInventoryOperation()(
      userId,
      selection.operation_id,
      JSON.parse(JSON.stringify({ kind: "bottling", input })),
      (value) => brewInventoryOutcomeSchema.parse(value),
      async (tx, operationId) => {
        await tx.$queryRaw`SELECT id FROM brews WHERE id=${input.brewId}::uuid AND user_id=${userId} FOR UPDATE`;
        await applyBottling(
          tx,
          userId,
          operationId,
          input,
          selection,
          async (tx) => {
            if (input.selection?.mode === "items") {
              await applyEntryInventoryLines(
                tx,
                userId,
                operationId,
                input,
                brewInventoryItemsSchema.parse(input.selection),
                writeEntry,
              );
            } else {
              if (
                input.selection?.mode === "deduct" ||
                (await tx.inventory_consumptions.count({
                  where: {
                    user_id: userId,
                    entry_id: input.entryId,
                    reversed_at: null,
                  },
                }))
              )
                throw new InventoryWriteError("SELECTION_REQUIRED");
              await writeEntry(tx);
            }
          },
        );
        await afterBottlingVolume?.(tx);
        return { status: "deducted" };
      },
    );
  }
  let productionNeedsReview = false;
  const originalWrite = writeEntry;
  writeEntry = async (tx) => {
    if (input.kind === "create") {
      const prior = await tx.inventory_bottlings.findUnique({
        where: { entry_id: input.entryId },
      });
      if (
        prior &&
        (prior.user_id !== userId ||
          prior.brew_id !== input.brewId ||
          prior.removed_at ||
          !(await tx.brew_entries.count({
            where: {
              id: input.entryId,
              brew_id: input.brewId,
              user_id: userId,
            },
          })))
      )
        throw new InventoryWriteError("USAGE_REMOVED");
    }
    const needsReview = await guardBottlingMutation(
      tx,
      userId,
      input.entryId,
      input.kind === "remove" ||
        (input.kind === "edit" && Object.hasOwn(input.entryMutation, "data")),
    );
    productionNeedsReview ||= needsReview === true;
    await originalWrite(tx);
  };
  if (input.selection?.mode === "items") {
    const selection = brewInventoryItemsSchema.parse(input.selection);
    return createInventoryOperation()(
      userId,
      selection.operation_id,
      JSON.parse(JSON.stringify({ kind: "entry_lines", input })),
      (value) => brewInventoryOutcomeSchema.parse(value),
      async (tx, operationId) =>
        applyEntryInventoryLines(
          tx,
          userId,
          operationId,
          input,
          selection,
          writeEntry,
        ),
    );
  }
  if (input.selection?.mode !== "deduct") {
    const result = await inventory.mutateUntrackedEntry(
      userId,
      input,
      writeEntry,
    );
    return productionNeedsReview
      ? { status: "reconciliation_required" }
      : result;
  }
  if (input.kind === "create" && input.entryMutation.type !== "ADDITION") {
    throw new InventoryWriteError("ENTRY_MISMATCH");
  }
  const data = input.entryMutation.data;
  if (
    input.kind !== "remove" &&
    (!data || typeof data !== "object" || Array.isArray(data))
  ) {
    throw new InventoryWriteError("ENTRY_MISMATCH");
  }
  const quantity =
    input.kind === "remove" ? null : additionInventoryQuantity(data);
  if (input.kind !== "remove" && !quantity)
    throw new InventoryWriteError("ENTRY_MISMATCH");
  const result = await inventory.mutateLinkedUsage(
    userId,
    input.selection.operation_id,
    {
      brewId: input.brewId,
      entryId: input.entryId,
      kind: input.kind,
      stockId: input.selection.stock_id,
      quantity,
      expected: input.selection.expected
        ? {
            stockId: input.selection.expected.stock_id,
            deducted: input.selection.expected.deducted,
          }
        : null,
      entryMutation: input.entryMutation,
    },
    writeEntry,
  );
  return {
    status: "deducted",
    balances: result.balances.map((item) => ({
      stock_id: item.stockId,
      quantity: item.balance,
    })),
  };
}
