export function isValidNumber(value: string) {
  return value === "" || /^-?\d*[.,٫]?\d*$/.test(value);
}

export function parseNumber(value: string | number): number {
  const stringValue = typeof value === "number" ? value.toString() : value;
  if (!stringValue) return Number.NaN;
  return parseFloat(stringValue.replace(/[٫,]/g, "."));
}
