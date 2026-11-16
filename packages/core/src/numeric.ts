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
