import { useState } from "react";
import { useTranslation } from "react-i18next";

import { inventoryCurrencyCodes, type QuantityUnit } from "@meadtools/inventory-domain";

import { CalculatorField, Chips } from "@/components/calculator-ui";

import { priceUnits, type PriceDraft } from "./price-draft";
import { StockButton, StockCard, StockInput, StockText } from "./stock-ui";

const commonCurrencies = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD"];

export function CurrencyPicker({ value, onChange, disabled }: {
  value: string | null;
  onChange: (code: string) => void;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const names = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames([language], { type: "currency" }) : null;
  const label = (code: string) => {
    const name = names?.of(code);
    return name && name !== code ? `${code} · ${name}` : code;
  };
  const filter = search.trim().toLocaleLowerCase(language);
  const options = filter ? inventoryCurrencyCodes().filter((code) => label(code).toLocaleLowerCase(language).includes(filter)).slice(0, 8)
    : [...new Set([...(value ? [value] : []), ...commonCurrencies])];
  return (
    <CalculatorField label={t("inventoryCosts.currency")}>
      <StockInput accessibilityLabel={t("inventoryCosts.currencySearch")} placeholder={t("inventoryCosts.currencySearch")}
        autoCorrect={false} value={search} onChangeText={setSearch} editable={!disabled} />
      {options.length ? (
        <Chips label={t("inventoryCosts.currency")} options={options} value={value}
          onChange={(code) => { if (!disabled) { onChange(code); setSearch(""); } }}
          optionLabel={label} />
      ) : <StockText kind="muted">{t("mobileInventory.noCurrencies")}</StockText>}
    </CalculatorField>
  );
}

export function StockPriceFields({ currency, stockUnit, draft, required, disabled, onChange, onCurrency }: {
  currency: string | null;
  stockUnit: QuantityUnit;
  draft: PriceDraft;
  required: boolean;
  disabled: boolean;
  onChange: (value: PriceDraft) => void;
  onCurrency: () => void;
}) {
  const { t } = useTranslation();
  const units: readonly QuantityUnit[] = priceUnits(stockUnit);
  const currentUnit = units.includes(draft.perUnit) ? draft.perUnit : stockUnit;
  return (
    <StockCard>
      <StockText kind="heading">{t(required ? "inventoryCosts.priceRequired" : "inventoryCosts.priceOptional")}</StockText>
      {currency ? (
        <>
          <CalculatorField label={`${t("inventoryCosts.pricePaid")} (${currency})`}>
            <StockInput accessibilityLabel={t("inventoryCosts.pricePaid")} inputMode="decimal" value={draft.amount}
              editable={!disabled} onChangeText={(amount) => onChange({ ...draft, amount })} />
          </CalculatorField>
          {required || draft.amount.trim() ? (
            <CalculatorField label={t("inventoryCosts.priceFor")} hint={t(required ? "inventoryCosts.valuationHelp" : "inventoryCosts.perDefaultHelp")}>
              <StockInput accessibilityLabel={t("inventoryCosts.priceFor")} inputMode="decimal" value={draft.perAmount}
                editable={!disabled} onChangeText={(perAmount) => onChange({ ...draft, perAmount })} />
              {units.length > 1 ? (
                <Chips label={t("inventoryCosts.priceUnit")} options={units} value={currentUnit}
                  onChange={(perUnit) => { if (!disabled) onChange({ ...draft, perUnit }); }}
                  optionLabel={(unit) => t(`inventory.units.${unit}`)} />
              ) : <StockText kind="muted">{t(`inventory.units.${currentUnit}`)}</StockText>}
            </CalculatorField>
          ) : null}
          <StockText kind="muted">{t("inventoryCosts.priceHelp")}</StockText>
        </>
      ) : (
        <StockButton label={t("inventoryCosts.currencyChoose")} onPress={onCurrency} disabled={disabled} />
      )}
    </StockCard>
  );
}
