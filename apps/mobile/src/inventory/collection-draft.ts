import type { FinishedMeadBottle, InventoryOrganizedStock, InventoryOrganizationResponse } from "@meadtools/api-contract";
import {
  createFinishedMeadRequestBodySchema,
  updateFinishedMeadRequestBodySchema,
  updateInventoryStorageRequestBodySchema
} from "@meadtools/api-contract/inventory";
import { convertQuantity, validateAllocationTotal, type BottleDisplaySize } from "@meadtools/inventory-domain";

import { parseDecimalInput } from "../outbox/gravity-entry-form";

export type BottleDraft = { key: string; size: string; unit: BottleDisplaySize["unit"]; count: string };
export type AllocationDraft = { key: string; locationId: string; position: string; amount: string };

function enteredBottle(row: BottleDraft) {
  const value = parseDecimalInput(row.size);
  if (value === null || value <= 0) return null;
  const display_size = { value, unit: row.unit };
  try {
    return { size_liters: convertQuantity(display_size, "L").value, display_size };
  } catch {
    return null;
  }
}

export function buildNewMead(operationId: string, name: string, notes: string, rows: BottleDraft[]) {
  const parsed = createFinishedMeadRequestBodySchema.safeParse({
    operation_id: operationId,
    mead: {
      name,
      notes: notes.trim() || null,
      bottles: rows.map((row) => ({ ...enteredBottle(row), quantity: parseDecimalInput(row.count) }))
    }
  });
  return parsed.success ? parsed.data : null;
}

export function buildMeadReceipt(
  operationId: string, revision: string, count: string, note: string, bottle: FinishedMeadBottle | BottleDraft
) {
  const size = "size_liters" in bottle ? { size_liters: bottle.size_liters } : enteredBottle(bottle);
  const parsed = updateFinishedMeadRequestBodySchema.safeParse({
    ...size,
    operation_id: operationId,
    expected_revision: revision,
    action: "receipt",
    quantity: parseDecimalInput(count),
    note: note.trim() || null
  });
  return parsed.success ? parsed.data : null;
}

export function buildStorageChange(stock: InventoryOrganizedStock, rows: AllocationDraft[], operationId: string, wholeUnits = stock.mead_id !== null) {
  const parsed = updateInventoryStorageRequestBodySchema.safeParse({
    operation_id: operationId,
    expected_revision: stock.revision,
    allocations: rows.map(({ locationId, position, amount }) => ({
      location_id: locationId,
      position,
      quantity: parseDecimalInput(amount)
    }))
  });
  if (!parsed.success) return null;
  const amounts = parsed.data.allocations.map(({ quantity }) => quantity);
  if (wholeUnits && amounts.some((amount) => !Number.isInteger(amount))) return null;
  try {
    const unlocated = validateAllocationTotal(stock.quantity, amounts);
    return { input: parsed.data, unlocated };
  } catch {
    return null;
  }
}

/** A location cannot be moved below itself or one of its descendants. */
export function possibleStorageParents(locations: InventoryOrganizationResponse["locations"], itemId?: string) {
  const descendants = new Set<string>();
  if (itemId) {
    const remaining = [itemId];
    while (remaining.length) {
      const parent = remaining.pop()!;
      if (descendants.has(parent)) continue;
      descendants.add(parent);
      for (const location of locations) {
        if (location.parent_id === parent) remaining.push(location.id);
      }
    }
  }
  return locations.filter(({ id }) => !descendants.has(id));
}
