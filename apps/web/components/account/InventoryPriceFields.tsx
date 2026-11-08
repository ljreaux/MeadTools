"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  capacityUnitSchema,
  purchasePriceSchema,
  quantityUnitSchema,
  type PurchasePrice,
  type QuantityUnit,
} from "@meadtools/inventory-domain";
import SearchableInput from "@/components/ui/SearchableInput";
import { AmountUnitField } from "@/components/ui/amount-unit-field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Units that convert to the stock unit; prices never infer density or packet size. */
export function compatibleUnits(unit: QuantityUnit): QuantityUnit[] {
  if (unit === "units") return ["units"];
  const volume = capacityUnitSchema.safeParse(unit).success;
  return quantityUnitSchema.options.filter((value) =>
    value !== "units" && capacityUnitSchema.safeParse(value).success === volume);
}

export function supportedCurrencyCodes(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "currency") => string[] };
  return intl.supportedValuesOf?.("currency") ?? ["USD", "EUR", "GBP", "CAD", "AUD"];
}

/** Searchable ISO 4217 choice, labeled in the viewer's language. */
export function CurrencyField({ id, value, onChange, disabled }: {
  id: string; value: string | null; onChange: (code: string) => void; disabled?: boolean;
}) {
  const { i18n, t } = useTranslation();
  const items = useMemo(() => {
    const names = new Intl.DisplayNames([i18n.resolvedLanguage ?? i18n.language], { type: "currency" });
    return supportedCurrencyCodes().map((code) => ({ code, label: `${code} · ${names.of(code) ?? code}` }));
  }, [i18n.resolvedLanguage, i18n.language]);
  const [query, setQuery] = useState(value ? items.find((item) => item.code === value)?.label ?? value : "");
  return (
    <SearchableInput
      id={id}
      items={items}
      query={query}
      setQuery={setQuery}
      keyName="label"
      getValue={(item) => item.code}
      placeholder={t("inventoryCosts.currencySearch")}
      disabled={disabled}
      openOnFocus={false}
      onSelect={(item) => {
        setQuery(item.label);
        onChange(item.code);
      }}
    />
  );
}

export type PriceDraft = { amount: string; perAmount: string; perUnit: QuantityUnit; currency: string | null };

export function emptyPriceDraft(unit: QuantityUnit, currency: string | null, perAmount = ""): PriceDraft {
  return { amount: "", perAmount, perUnit: unit, currency };
}

/**
 * Null when no price was entered; "invalid" when entered but unusable. A blank
 * package quantity means the price covers the fallback (received) quantity.
 */
export function parsePriceDraft(
  draft: PriceDraft,
  fallbackPer: { value: number; unit: QuantityUnit } | null,
): PurchasePrice | null | "invalid" {
  if (!draft.amount.trim()) return null;
  const per = draft.perAmount.trim()
    ? { value: Number(draft.perAmount), unit: draft.perUnit }
    : fallbackPer;
  const parsed = purchasePriceSchema.safeParse({
    amount: Number(draft.amount),
    currency: draft.currency,
    per: per ?? { value: NaN, unit: draft.perUnit },
  });
  return parsed.success ? parsed.data : "invalid";
}

/**
 * Total paid for a package, entered as "amount for quantity". Tax and
 * shipping belong in the amount when the owner wants them counted.
 */
export function InventoryPriceFields({ id, draft, onChange, stockUnit, accountCurrency, required, perPlaceholder, disabled }: {
  id: string;
  draft: PriceDraft;
  onChange: (draft: PriceDraft) => void;
  stockUnit: QuantityUnit;
  accountCurrency: string | null;
  required?: boolean;
  perPlaceholder?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const units = compatibleUnits(stockUnit);
  return (
    <fieldset className="space-y-3 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">{t(required ? "inventoryCosts.priceRequired" : "inventoryCosts.priceOptional")}</legend>
      {!accountCurrency ? (
        <div className="space-y-2">
          <Label htmlFor={`${id}-currency`}>{t("inventoryCosts.currency")}</Label>
          <CurrencyField id={`${id}-currency`} value={draft.currency} onChange={(currency) => onChange({ ...draft, currency })} disabled={disabled} />
          <p className="text-xs text-muted-foreground">{t("inventoryCosts.currencyFirstHelp")}</p>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-price`}>{t("inventoryCosts.pricePaid")}</Label>
          <AmountUnitField id={`${id}-price`} amount={draft.amount} unit={draft.currency ?? "—"} onAmountChange={(amount) => onChange({ ...draft, amount })} disabled={disabled} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-per`}>{t("inventoryCosts.priceFor")}</Label>
          <AmountUnitField
            id={`${id}-per`}
            amount={draft.perAmount}
            unit={t(`inventory.units.${draft.perUnit}`)}
            onAmountChange={(perAmount) => onChange({ ...draft, perAmount })}
            disabled={disabled}
            unitControl={units.length > 1 ? (
              <Select value={draft.perUnit} onValueChange={(perUnit) => onChange({ ...draft, perUnit: perUnit as QuantityUnit })} disabled={disabled}>
                <SelectTrigger aria-label={t("inventoryCosts.priceUnit")} className="w-auto min-w-16 border-none shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>{units.map((unit) => <SelectItem key={unit} value={unit}>{t(`inventory.units.${unit}`)}</SelectItem>)}</SelectContent>
              </Select>
            ) : undefined}
          />
          {perPlaceholder ? <p className="text-xs text-muted-foreground">{perPlaceholder}</p> : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("inventoryCosts.priceHelp")}</p>
    </fieldset>
  );
}
