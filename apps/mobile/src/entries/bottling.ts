import type { BrewInventoryContextResponse, BrewInventorySelection } from "@meadtools/api-contract";
import { entryPayload, type BrewPackagingData } from "@meadtools/brew-domain/entry-payload";
import { BOTTLE_SIZES_L, L_PER_GAL, bottleVolumeLiters } from "@meadtools/core/extra-calculators";
import {
  bottlingSelectionSchema,
  InventoryError,
  inventoryEntryLines,
  matchInventoryStock,
  planEntryInventory,
  productionBottleRows,
  validateBottlingOutputs,
  type BottlingSelection
} from "@meadtools/inventory-domain";

import { parseNumberField } from "../outbox/entry-forms";
import type { StockItem } from "./inventory-deduction";

type SizeUnit = NonNullable<NonNullable<BrewPackagingData["bottleRows"]>[number]["customSizeUnits"]>;
export type BottleDraft = { id: string; size: string; custom: string; customUnit: SizeUnit; quantity: string };
export type ClosureDraft = { id: string; name: string; quantity: string };
export type PackagingDraft = { bottles: BottleDraft[]; closures: ClosureDraft[]; volume: string; unit: "L" | "gal"; note: string };
export type BottlingSource = BrewInventoryContextResponse["bottlings"][number];
export type StockUse = BrewInventoryContextResponse["usages"][number];
export type PackagingPayload = ReturnType<typeof entryPayload.packaging>;

export class BottlingReviewError extends Error {
  readonly code = "RECONCILIATION_REQUIRED";
}

export function emptyBottle(id: string): BottleDraft {
  return { id, size: "750ml", custom: "", customUnit: "ml", quantity: "" };
}

export function initialPackagingDraft(data: Partial<BrewPackagingData>, note: string, newId: () => string): PackagingDraft {
  const unit = data.displayUnit === "gal" ? "gal" : "L";
  return {
    unit,
    note,
    volume: data.displayValue != null ? String(data.displayValue)
      : data.packagedVolumeLiters != null ? String(data.packagedVolumeLiters / (unit === "gal" ? L_PER_GAL : 1)) : "",
    bottles: (data.bottleRows ?? []).map((row) => {
      const preset = Object.hasOwn(BOTTLE_SIZES_L, row.label) && BOTTLE_SIZES_L[row.label] === row.sizeLiters;
      return {
        id: row.id ?? newId(),
        size: preset ? row.label : "custom",
        custom: String(row.customSizeValue ?? row.sizeLiters * 1000),
        customUnit: row.customSizeUnits ?? "ml",
        quantity: String(row.quantity)
      };
    }),
    closures: (data.closures ?? []).map((row) => ({ ...row, id: row.id ?? newId(), quantity: String(row.quantity) }))
  };
}

export function wholeCount(text: string): number {
  const value = Number(text);
  if (!/^\d+$/.test(text.trim()) || !Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000) {
    throw new InventoryError("INVALID_QUANTITY");
  }
  return value;
}

function positiveDecimal(text: string) {
  const result = parseNumberField(text, { min: 0, exclusiveMin: true, max: 1_000_000_000 });
  if (!result.ok) throw new InventoryError("INVALID_QUANTITY");
  return result.value;
}

export function buildPackaging(draft: PackagingDraft, datetime: string): PackagingPayload {
  const bottleRows = draft.bottles.map((row) => {
    const quantity = wholeCount(row.quantity);
    const customSizeValue = row.size === "custom" ? positiveDecimal(row.custom) : undefined;
    const sizeLiters = customSizeValue == null ? BOTTLE_SIZES_L[row.size] : bottleVolumeLiters(customSizeValue, row.customUnit);
    return {
      id: row.id, label: row.size === "custom" ? "Custom" : row.size, quantity, sizeLiters,
      totalLiters: sizeLiters * quantity,
      customSizeValue, customSizeUnits: customSizeValue == null ? undefined : row.customUnit
    };
  });
  productionBottleRows({ bottleRows });
  const closures = draft.closures.map((row) => ({ id: row.id, name: row.name.trim(), quantity: wholeCount(row.quantity) }));
  const factor = draft.unit === "gal" ? L_PER_GAL : 1;
  const bottleVolume = bottleRows.reduce((sum, row) => sum + row.totalLiters, 0);
  const displayValue = draft.volume.trim() ? positiveDecimal(draft.volume) : bottleVolume / factor;
  const packagedVolumeLiters = draft.volume.trim() ? displayValue * factor : bottleVolume;
  if (!Number.isFinite(packagedVolumeLiters) || packagedVolumeLiters <= 0 || packagedVolumeLiters > 1_000_000_000) throw new InventoryError("INVALID_QUANTITY");
  const payload = entryPayload.packaging({
    packagedVolumeLiters, displayValue, displayUnit: draft.unit, bottleRows, closures,
    datetime, note: draft.note.trim() || null
  });
  inventoryEntryLines("PACKAGING", payload.data);
  return payload;
}

export function packagingStockReview(
  payload: PackagingPayload | null,
  stock: readonly StockItem[],
  previous: readonly StockUse[],
  choices: Readonly<Record<string, string | null>>,
  legacyKeys: Readonly<Record<string, string>> = {}
) {
  const lines = payload ? inventoryEntryLines("PACKAGING", payload.data) : [];
  const rows = lines.map((line) => {
    const match = matchInventoryStock(stock, line);
    const linked = previous.find((use) => use.line_key === line.key || use.line_key === legacyKeys[line.key]);
    const prior = linked && !linked.stock_archived ? linked.stock_id : undefined;
    const selected = Object.hasOwn(choices, line.key) ? choices[line.key] : linked
      ? match.choices.some((item) => item.id === prior) ? prior! : null
      : match.warning === "linked_ambiguous" ? null : match.stock?.id ?? null;
    return { line, options: match.choices, selected };
  });
  const bindings = rows.map(({ line, selected }) => ({ line_key: line.key, stock_id: selected }));
  const expected = previous.map(({ line_key, stock_id, deducted }) => ({ line_key, stock_id, deducted }));
  const allStock = new Map(previous.map((item) => [item.stock.id, item.stock]));
  for (const item of stock) allStock.set(item.id, item);
  const balances = () => planEntryInventory({ stocks: [...allStock.values()], lines, bindings, previous: expected }).balances;
  const selection = (operationId: string): BrewInventorySelection => ({
    mode: "items", operation_id: operationId, items: bindings, expected
  });
  return { rows, balances, selection, stock: allStock };
}

export function buildBottlingSelection(input: {
  payload: PackagingPayload | null;
  source?: BottlingSource;
  operationId: string;
  mode: BottlingSelection["mode"];
  confirmed: boolean;
  outputs: BottlingSelection["outputs"];
  correcting: boolean;
}) {
  const selection = bottlingSelectionSchema.parse({
    operation_id: input.operationId,
    expected_revision: input.source?.revision ?? null,
    mode: input.mode,
    confirmed_on_hand: input.confirmed,
    outputs: input.outputs
  });
  validateBottlingOutputs(input.payload ? productionBottleRows(input.payload.data) : [], selection.outputs);
  if ((input.source?.reconciliation_required || input.mode === "reconcile"
    || (input.correcting && !input.source?.outputs.length && selection.outputs.length > 0)) && !input.confirmed) {
    throw new BottlingReviewError("Review on-hand counts before reconciling");
  }
  if ((input.source?.reconciliation_required && input.mode !== "reconcile")
    || (input.mode === "reconcile" && selection.outputs.some((output) => output.target.kind === "new"))) {
    throw new BottlingReviewError("Review on-hand counts before reconciling");
  }
  return selection;
}
