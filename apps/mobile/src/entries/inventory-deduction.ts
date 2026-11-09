import { MeadToolsApiError } from "@meadtools/api-client";
import type {
  BrewInventorySelection,
  InventoryOverviewResponse
} from "@meadtools/api-contract";
import {
  InventoryError,
  matchInventoryStock,
  planEntryInventory,
  tryInventoryEntryLines,
  type InventoryLine,
  type Quantity
} from "@meadtools/inventory-domain";

/**
 * Online-only stock deduction for a new manual addition. Mirrors the web's
 * stock field: the same line derivation, stock matching, balance planning
 * and `items` selection, so the server applies the same rules.
 */

export type StockItem = InventoryOverviewResponse["stock"][number];
export const UNTRACKED = "untracked" as const;
export type StockChoice = string | typeof UNTRACKED;

export type AdditionStockPlan = {
  /** The single inventory line for the addition, or null without an amount. */
  line: InventoryLine | null;
  /** Compatible stock (category and unit), excluding stock needing review. */
  choices: StockItem[];
  /** The web's default: the matched stock, otherwise log without stock. */
  defaultChoice: StockChoice;
};

export function planAdditionStock(
  stock: readonly StockItem[],
  additionData: unknown
): AdditionStockPlan {
  const lines = tryInventoryEntryLines("ADDITION", additionData);
  const line = lines.length === 1 ? lines[0] : null;
  if (!line) return { line: null, choices: [], defaultChoice: UNTRACKED };
  const match = matchInventoryStock(stock, line);
  return {
    line,
    choices: match.choices,
    defaultChoice:
      match.warning === "linked_ambiguous" ? UNTRACKED : (match.stock?.id ?? UNTRACKED)
  };
}

export type BalancePreview =
  | { ok: true; balance: Quantity }
  | { ok: false; code: string; shortage?: number; unit?: string };

/** The stock's recorded quantity after this use, or why it cannot be deducted. */
export function previewBalance(
  stock: readonly StockItem[],
  line: InventoryLine,
  stockId: string
): BalancePreview {
  try {
    const plan = planEntryInventory({
      stocks: stock,
      lines: [line],
      bindings: [{ line_key: line.key, stock_id: stockId }],
      previous: []
    });
    const balance = plan.balances.find((item) => item.stock_id === stockId);
    return balance ? { ok: true, balance: balance.quantity } : { ok: false, code: "NOT_FOUND" };
  } catch (error) {
    if (error instanceof InventoryError) {
      const shortage = error.details?.shortage;
      const unit = error.details?.unit;
      return {
        ok: false,
        code: error.code,
        shortage: typeof shortage === "number" ? shortage : undefined,
        unit: typeof unit === "string" ? unit : undefined
      };
    }
    return { ok: false, code: "INCOMPATIBLE_UNITS" };
  }
}

/** The web's selection for a new addition bound to one stock item. */
export function buildDeductionSelection(
  line: InventoryLine,
  stockId: string,
  operationId: string
): BrewInventorySelection {
  return {
    mode: "items",
    operation_id: operationId,
    items: [{ line_key: line.key, stock_id: stockId }],
    expected: []
  };
}

/** The server's inventory error code (`inventory.errors.<code>`), if any. */
export function inventoryErrorCode(error: unknown): string | null {
  if (!(error instanceof MeadToolsApiError)) return null;
  const body = error.body as { code?: unknown } | null | undefined;
  return typeof body?.code === "string" ? body.code : null;
}
