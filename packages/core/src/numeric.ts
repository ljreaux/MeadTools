export function isValidNumber(value: string) {
  return value === "" || /^-?\d*[.,٫]?\d*$/.test(value);
}

export function parseNumber(value: string | number): number {
  const stringValue = typeof value === "number" ? value.toString() : value;
  if (!stringValue) return Number.NaN;
  return parseFloat(stringValue.replace(/[٫,]/g, "."));
}

/**
 * Rounds a calculator result for display: fixed precision, near-zero and
 * negative zero shown as 0, and non-finite math shown as 0. Web and Mobile
 * format the returned number with their own locale formatter.
 */
export function roundForDisplay(num: number, digits: number): number {
  let rounded = Number(num.toFixed(digits));
  if (Math.abs(rounded) < Math.pow(10, -digits)) rounded = 0;
  if (Object.is(rounded, -0) || Number.isNaN(rounded)) rounded = 0;
  return rounded;
}

/** The last unit switch of one field, so switching straight back can undo it. */
export type UnitSwitch<U extends string> = {
  from: U;
  to: U;
  before: string;
  after: string;
};

/**
 * Converts a typed value when its unit changes. Switching straight back,
 * without editing the converted text, restores exactly what was typed instead
 * of converting the rounded value back (240 ml → 8.1154 fl oz → 240 ml, not
 * 240.0008 ml). Callers keep `last` per field and pass it to the next switch.
 */
export function switchUnitText<U extends string>(
  text: string,
  from: U,
  to: U,
  convert: (text: string) => string,
  last: UnitSwitch<U> | null
): { text: string; last: UnitSwitch<U> | null } {
  if (from === to) return { text, last };
  if (last && last.from === to && last.to === from && last.after === text) {
    return { text: last.before, last: null };
  }
  const converted = convert(text);
  return { text: converted, last: { from, to, before: text, after: converted } };
}
