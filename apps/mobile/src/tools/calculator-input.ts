import {
  convertStabilizerVolume,
  type StabilizerVolumeUnit
} from "@meadtools/core/extra-calculators";
import { roundForDisplay } from "@meadtools/core/numeric";
import { convertTemperature } from "@meadtools/core/temperature";

import { isIncompleteDecimal, parseDecimalInput } from "../outbox/gravity-entry-form";

/**
 * Reads a calculator field typed with `.` or `,` as the decimal separator.
 * Empty, half-typed ("1.") or invalid text gives `null`, so a result shows as
 * unavailable instead of the web's 0.
 */
export function readCalculatorNumber(text: string): number | null {
  if (isIncompleteDecimal(text)) return null;
  return parseDecimalInput(text);
}

/** Reads every field; `null` when any of them is not a number yet. */
export function readCalculatorNumbers<T extends readonly string[]>(
  texts: T
): { [K in keyof T]: number } | null {
  const values = texts.map(readCalculatorNumber);
  return values.every((value): value is number => value !== null)
    ? (values as { [K in keyof T]: number })
    : null;
}

/**
 * Formats a result with the web's display rounding. `fixed` keeps trailing
 * zeros, as the web does for specific gravity (1.050).
 */
export function formatCalculatorResult(
  locale: string,
  value: number,
  digits: number,
  fixed = false
): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: fixed ? digits : 0
  }).format(roundForDisplay(value, digits));
}

/** Text for a prefilled field, using the device locale's decimal separator. */
export function calculatorInputText(locale: string, value: number, digits = 3): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    useGrouping: false
  }).format(value);
}

/** Converts a typed temperature when the scale changes (1 decimal place). */
export function convertTemperatureText(
  locale: string,
  text: string,
  from: "F" | "C",
  to: "F" | "C"
): string {
  if (from === to) return text;
  const value = readCalculatorNumber(text);
  if (value === null) return text;
  return calculatorInputText(locale, convertTemperature(value, from, to), 1);
}

/** Converts a typed stabilizer batch volume when its unit changes. */
export function convertStabilizerVolumeText(
  locale: string,
  text: string,
  from: StabilizerVolumeUnit,
  to: StabilizerVolumeUnit
): string {
  if (from === to) return text;
  const value = readCalculatorNumber(text);
  if (value === null) return text;
  return calculatorInputText(locale, convertStabilizerVolume(value, from, to), 3);
}

/**
 * Converts a typed batch volume between gallons and liters with a calculator's
 * own factor (the web uses 3.785 for stabilizers and 3.78541 elsewhere).
 */
export function convertVolumeText(
  locale: string,
  text: string,
  from: "gal" | "lit",
  to: "gal" | "lit",
  litersPerGallon: number
): string {
  if (from === to) return text;
  const value = readCalculatorNumber(text);
  if (value === null) return text;
  const converted = to === "lit" ? value * litersPerGallon : value / litersPerGallon;
  return calculatorInputText(locale, Math.round(converted * 1000) / 1000, 3);
}

/** The translation key the web uses for a catalog name ("Table Sugar" → "tableSugar"). */
export function catalogLabelKey(name: string): string {
  const words = name.match(/[A-Za-z0-9]+/g) ?? [];
  return words
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase()
    )
    .join("");
}
