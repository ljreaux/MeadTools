import { toBrix } from "@meadtools/core/gravity";
import { normalizeNumberString } from "@/lib/utils/validateInput";

export function formatSgDisplay(value?: number | null, locale?: string, fallback = "—") {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return normalizeNumberString(value, 3, locale, true);
}

export function formatBrixNumber(value?: number | null, locale?: string, fallback = "—") {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return normalizeNumberString(value, 2, locale, true);
}

export function formatBrixDisplay(
  value: number | null | undefined,
  brixLabel: string,
  locale?: string,
  fallback = "—"
) {
  const formatted = formatBrixNumber(value, locale, fallback);
  return formatted === fallback ? fallback : `${formatted} ${brixLabel}`;
}

export function formatSgAsBrixDisplay(
  sg: number | null | undefined,
  brixLabel: string,
  locale?: string,
  fallback = "—"
) {
  if (typeof sg !== "number" || !Number.isFinite(sg)) return fallback;
  return formatBrixDisplay(toBrix(sg), brixLabel, locale, fallback);
}
