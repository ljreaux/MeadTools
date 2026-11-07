import type { BottleDisplaySize } from "@meadtools/inventory-domain";

/** Display the bottle the user entered; canonical liters are calculation data. */
export function formatBottleSize(size: BottleDisplaySize, locale: string): string {
  const amount = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(size.value);
  return `${amount} ${{ mL: "mL", L: "L", fl_oz: "fl oz", gal: "gal" }[size.unit]}`;
}
export function formatStoredBottleSize(row: { size_liters: number; display_size?: BottleDisplaySize | null }, locale: string): string {
  return formatBottleSize(row.display_size ?? { value: row.size_liters, unit: "L" }, locale);
}
