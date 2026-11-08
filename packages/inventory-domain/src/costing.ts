import { z } from "zod";
import {
  convertQuantity,
  InventoryError,
  quantitySchema,
  toQuantityTicks,
  type Quantity,
  type QuantityUnit,
} from "./quantity";
import type { CatalogReference } from "./schemas";

/**
 * Ingredient costing uses a moving weighted average per stock item, in one
 * account currency. Rules (decided for #513):
 * - A priced receipt averages into the existing balance at its known cost.
 * - An unpriced receipt makes the average unknown; it is never assumed to
 *   match earlier prices. The owner can set the current unit cost explicitly.
 * - Uses, manual uses, counts and returns leave the average unchanged.
 * - Brew uses snapshot the average at deduction; later price changes never
 *   rewrite a snapshot unless the owner explicitly recalculates.
 * - Tax and shipping are included in the entered price. No FX conversion.
 */

/** ISO 4217 code. Prices in any other currency than the account's are rejected. */
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .refine((code) => supportedCurrencies().has(code), {
    message: "Unsupported currency",
  });
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;

let currencies: Set<string> | null = null;
function supportedCurrencies(): Set<string> {
  if (!currencies) {
    const intl = Intl as typeof Intl & {
      supportedValuesOf?: (key: "currency") => string[];
    };
    currencies = new Set(intl.supportedValuesOf?.("currency") ?? []);
  }
  return currencies;
}

/** Entered money amounts (tax/shipping included) keep at most four decimals. */
export const MAX_PRICE = 1_000_000_000;
const MONEY_SCALE = 10_000;
export const priceAmountSchema = z
  .number()
  .finite()
  .min(0)
  .max(MAX_PRICE)
  .refine((value) => value === Math.round(value * MONEY_SCALE) / MONEY_SCALE, {
    message: "Price supports at most four decimal places",
  });

/** A price paid for a stated package, e.g. 30 USD per 5 kg. */
export const purchasePriceSchema = z
  .object({
    amount: priceAmountSchema,
    currency: currencyCodeSchema,
    per: quantitySchema.refine((quantity) => quantity.value > 0, {
      message: "Price quantity must be greater than zero",
    }),
  })
  .strict();
export type PurchasePrice = z.infer<typeof purchasePriceSchema>;

export type CostErrorCode = "CURRENCY_REQUIRED" | "CURRENCY_MISMATCH";
export class InventoryCostError extends Error {
  constructor(
    public readonly code: CostErrorCode,
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(code);
    this.name = "InventoryCostError";
  }
}

/** Unit costs keep ten decimals so mg/mL prices remain meaningful. */
const UNIT_COST_SCALE = 1e10;
export const roundUnitCost = (value: number) =>
  Math.round(value * UNIT_COST_SCALE) / UNIT_COST_SCALE;

/** Line costs and totals use micro-units of the currency before display rounding. */
const COST_SCALE = 1_000_000;
const toCostTicks = (value: number) => Math.round(value * COST_SCALE);
const fromCostTicks = (ticks: number) => ticks / COST_SCALE;

export type StockCost = {
  /** Currency per one stock unit; null when unknown. */
  unitCost: number | null;
  currency: string | null;
};

function requireAccountCurrency(
  price: PurchasePrice,
  accountCurrency: string | null,
) {
  if (!accountCurrency) throw new InventoryCostError("CURRENCY_REQUIRED");
  if (price.currency !== accountCurrency)
    throw new InventoryCostError("CURRENCY_MISMATCH", {
      expected: accountCurrency,
      received: price.currency,
    });
}

/** Unit cost in the stock's unit, converting only within one dimension. */
export function unitCostFromPrice(
  input: PurchasePrice,
  stockUnit: QuantityUnit,
): number {
  const price = purchasePriceSchema.parse(input);
  const per = convertQuantity(price.per, stockUnit);
  return roundUnitCost(price.amount / per.value);
}

export type CostPlan = {
  cost: StockCost;
  /** Present when a price was entered; persist it as price history. */
  appliedUnitCost: number | null;
};

/**
 * Average a receipt into the current stock. Balance is the quantity before
 * the receipt, in the stock unit. Returns the next stock cost.
 */
export function planReceiptCost(input: {
  balance: Quantity;
  current: StockCost;
  receipt: Quantity;
  price: PurchasePrice | null;
  accountCurrency: string | null;
}): CostPlan {
  const balance = quantitySchema.parse(input.balance);
  const received = convertQuantity(input.receipt, balance.unit);
  if (!input.price) {
    // Unknown cost for part of the balance makes the whole average unknown.
    if (received.value === 0) return { cost: input.current, appliedUnitCost: null };
    return { cost: { unitCost: null, currency: null }, appliedUnitCost: null };
  }
  requireAccountCurrency(input.price, input.accountCurrency);
  const unitCost = unitCostFromPrice(input.price, balance.unit);
  const currency = input.price.currency;
  const before = toQuantityTicks(balance.value);
  const added = toQuantityTicks(received.value);
  if (before === 0) return { cost: { unitCost, currency }, appliedUnitCost: unitCost };
  if (input.current.unitCost === null) {
    // Existing stock has no known cost; the owner must value it explicitly.
    return { cost: { unitCost: null, currency: null }, appliedUnitCost: unitCost };
  }
  if (input.current.currency !== currency)
    throw new InventoryCostError("CURRENCY_MISMATCH", {
      expected: input.current.currency,
      received: currency,
    });
  if (added === 0) return { cost: input.current, appliedUnitCost: unitCost };
  const averaged =
    (before * input.current.unitCost + added * unitCost) / (before + added);
  return { cost: { unitCost: roundUnitCost(averaged), currency }, appliedUnitCost: unitCost };
}

/** Explicit owner valuation of all current stock, replacing any average. */
export function planValuationCost(input: {
  stockUnit: QuantityUnit;
  price: PurchasePrice;
  accountCurrency: string | null;
}): CostPlan {
  requireAccountCurrency(input.price, input.accountCurrency);
  const unitCost = unitCostFromPrice(input.price, input.stockUnit);
  return {
    cost: { unitCost, currency: input.price.currency },
    appliedUnitCost: unitCost,
  };
}

export type CostLineStatus =
  | "priced"
  | "unpriced"
  | "unmatched"
  | "ambiguous"
  | "incompatible"
  /** The owner chose not to track this ingredient's cost (e.g. tap water). */
  | "excluded";

/**
 * An account-wide choice never to track an ingredient's cost, such as tap
 * water. It matches the ingredient (catalog identity or exact normalized line
 * name), never a stock item, so it cannot spread between brews through shared
 * stock; per-batch choices such as reused bottles belong on the recorded use.
 * It wins over a known price and is applied when costs are read, so it also
 * covers earlier uses; removing it restores their saved snapshots.
 */
export type CostExclusion = { name: string; catalogReference: CatalogReference | null };

export const normalizeCostName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function matchesCostExclusion(
  line: { name: string; catalogReference?: CatalogReference | null },
  exclusions: readonly CostExclusion[],
): boolean {
  const name = normalizeCostName(line.name);
  return exclusions.some((exclusion) =>
    (name !== "" && normalizeCostName(exclusion.name) === name) ||
    (line.catalogReference && exclusion.catalogReference &&
      line.catalogReference.catalog === exclusion.catalogReference.catalog &&
      line.catalogReference.id === exclusion.catalogReference.id));
}

export type CostLineInput = {
  key: string;
  name: string;
  quantity: Quantity | null;
  stock: {
    id: string;
    name: string;
    unit: QuantityUnit;
    cost: StockCost;
  } | null;
  /** Why no stock was chosen. */
  unmatchedReason?: "unmatched" | "ambiguous" | "incompatible";
  /** Estimates only: matched stock on hand, to flag a planned shortfall. */
  available?: Quantity;
  /** Identity used to offer and match "don't track cost". */
  catalogReference?: CatalogReference | null;
  /** Entry line kind, e.g. INGREDIENT or PACKAGING. */
  kind?: string | null;
  /** The owner excluded this ingredient or this recorded use; it is never costed. */
  excluded?: boolean;
};

export type CostLine = {
  key: string;
  name: string;
  quantity: Quantity | null;
  stockId: string | null;
  stockName: string | null;
  status: CostLineStatus;
  /** In the stock unit; only when priced. */
  unitCost: number | null;
  unit: QuantityUnit | null;
  currency: string | null;
  cost: number | null;
  /** Needed beyond the stock on hand, in the stock unit; null when covered or unknown. */
  shortage: Quantity | null;
  catalogReference: CatalogReference | null;
  kind: string | null;
};

/** One line's cost: quantity converted to the stock unit times its unit cost. */
export function costLine(input: CostLineInput): CostLine {
  const line = pricedLine(input);
  return input.excluded
    ? { ...line, status: "excluded", unitCost: null, currency: null, cost: null, shortage: null }
    : line;
}

function pricedLine(input: CostLineInput): CostLine {
  const base = {
    catalogReference: input.catalogReference ?? null,
    kind: input.kind ?? null,
    key: input.key,
    name: input.name,
    quantity: input.quantity,
    stockId: input.stock?.id ?? null,
    stockName: input.stock?.name ?? null,
    unitCost: null,
    unit: input.stock?.unit ?? null,
    currency: null,
    cost: null,
    shortage: null,
  };
  if (!input.stock || !input.quantity)
    return { ...base, status: input.quantity ? input.unmatchedReason ?? "unmatched" : "incompatible" };
  let converted: Quantity;
  try {
    converted = convertQuantity(input.quantity, input.stock.unit);
  } catch (error) {
    if (error instanceof InventoryError) return { ...base, status: "incompatible" };
    throw error;
  }
  let shortage: Quantity | null = null;
  if (input.available) {
    const missing = toQuantityTicks(converted.value) -
      toQuantityTicks(convertQuantity(input.available, input.stock.unit).value);
    if (missing > 0) shortage = { value: missing / 1_000_000, unit: input.stock.unit };
  }
  const { unitCost, currency } = input.stock.cost;
  if (unitCost === null || !currency) return { ...base, shortage, status: "unpriced" };
  return {
    ...base,
    shortage,
    status: "priced",
    unitCost,
    currency,
    cost: fromCostTicks(toCostTicks(converted.value * unitCost)),
  };
}

export type CostBasis = "recipe_estimate" | "recorded_usage";

export type CostSummary = {
  basis: CostBasis;
  lines: CostLine[];
  /** One total per currency; never added across currencies. */
  totals: Array<{ currency: string; amount: number }>;
  /** True only when there are lines and every one is priced in a single currency. */
  complete: boolean;
  missing: Record<Exclude<CostLineStatus, "priced" | "excluded">, number>;
  /** Lines the owner chose not to cost; they never make a total incomplete. */
  excludedLines: number;
  mixedCurrencies: boolean;
  /** Lines needing more than the matched stock on hand (estimates). */
  shortLines: number;
};

export function summarizeCosts(basis: CostBasis, lines: readonly CostLine[]): CostSummary {
  const totals = new Map<string, number>();
  const missing = { unpriced: 0, unmatched: 0, ambiguous: 0, incompatible: 0 };
  let excludedLines = 0;
  for (const line of lines) {
    if (line.status === "priced") {
      totals.set(line.currency!, (totals.get(line.currency!) ?? 0) + toCostTicks(line.cost!));
    } else if (line.status === "excluded") excludedLines++;
    else missing[line.status]++;
  }
  const mixedCurrencies = totals.size > 1;
  return {
    basis,
    lines: [...lines],
    totals: [...totals]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, ticks]) => ({ currency, amount: fromCostTicks(ticks) })),
    complete:
      lines.length > 0 &&
      !mixedCurrencies && Object.values(missing).every((count) => count === 0),
    missing,
    excludedLines,
    mixedCurrencies,
    shortLines: lines.filter((line) => line.shortage !== null).length,
  };
}

/** Labeled estimate only; null when no positive volume is known. */
export function costPerLiter(amount: number, liters: number | null): number | null {
  if (liters === null || !Number.isFinite(liters) || liters <= 0) return null;
  return fromCostTicks(toCostTicks(amount / liters));
}

/**
 * Allocate a batch total to bottle sizes by volume. This is an estimate:
 * packaging and ingredient costs are spread across all bottled liters.
 */
export function costPerBottle(
  amount: number,
  bottles: readonly { sizeLiters: number; count: number }[],
): Array<{ sizeLiters: number; count: number; amount: number }> | null {
  const valid = bottles.filter(
    (row) => row.count > 0 && Number.isFinite(row.sizeLiters) && row.sizeLiters > 0,
  );
  const liters = valid.reduce((sum, row) => sum + row.sizeLiters * row.count, 0);
  if (!valid.length || liters <= 0) return null;
  return valid.map((row) => ({
    sizeLiters: row.sizeLiters,
    count: row.count,
    amount: fromCostTicks(toCostTicks((amount * row.sizeLiters) / liters)),
  }));
}

/** Round to the currency's display digits (USD 2, JPY 0) for presentation. */
export function roundMoney(amount: number, currency: string): number {
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency })
      .resolvedOptions().maximumFractionDigits ?? 2;
  const factor = 10 ** digits;
  return Math.round(amount * factor) / factor;
}
