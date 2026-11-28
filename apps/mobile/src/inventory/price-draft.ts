import {
  capacityUnitSchema,
  purchasePriceSchema,
  quantityUnitSchema,
  type PurchasePrice,
  type Quantity,
  type QuantityUnit
} from "@meadtools/inventory-domain";

import { parseDecimalInput } from "../outbox/gravity-entry-form";

export type PriceDraft = { amount: string; perAmount: string; perUnit: QuantityUnit };

export function priceUnits(stockUnit: QuantityUnit) {
  if (stockUnit === "units") return ["units"] as const;
  const volume = capacityUnitSchema.safeParse(stockUnit).success;
  return quantityUnitSchema.options.filter((unit) =>
    unit !== "units" && capacityUnitSchema.safeParse(unit).success === volume
  );
}

export function parseStockPrice(
  draft: PriceDraft, currency: string | null, stockUnit: QuantityUnit, received: Quantity | null
): PurchasePrice | null | "invalid" {
  if (!draft.amount.trim()) return null;
  const units: readonly QuantityUnit[] = priceUnits(stockUnit);
  const unit = units.includes(draft.perUnit) ? draft.perUnit : stockUnit;
  const parsed = purchasePriceSchema.safeParse({
    amount: parseDecimalInput(draft.amount),
    currency,
    per: draft.perAmount.trim() ? { value: parseDecimalInput(draft.perAmount), unit } : received
  });
  return parsed.success ? parsed.data : "invalid";
}
