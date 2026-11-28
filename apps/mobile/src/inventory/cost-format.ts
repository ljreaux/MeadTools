import { useTranslation } from "react-i18next";

export function useCostFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  function money(amount: number, currency: string, unitCost = false) {
    const base = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "code" });
    if (!unitCost) return base.format(amount);
    return new Intl.NumberFormat(locale, {
      style: "currency", currency, currencyDisplay: "code",
      maximumFractionDigits: Math.max(amount > 0 && amount < 0.0001 ? 10 : 4, base.resolvedOptions().maximumFractionDigits ?? 2)
    }).format(amount);
  }

  const quantity = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });
  return { money, number: (value: number) => quantity.format(value) };
}
