export const isValidNumber = (value: string) => {
  return value === "" || /^-?\d*[.,٫]?\d*$/.test(value);
};
export const parseNumber = (value: string | number): number => {
  let val: string | number = value;
  if (typeof val === "number") val = val.toString();

  if (!val) return NaN;

  // Replace any of the supported decimal separators with `.`
  const normalizedValue = val.replace(/[٫,]/g, ".");

  // Parse the normalized string into a float and return
  return parseFloat(normalizedValue);
};

export const normalizeNumberString = (
  num: number,
  digits: number,
  locale?: string,
  clamp?: boolean
) => {
  // First, round to the desired precision
  let rounded = Number(num.toFixed(digits));

  // If it's extremely close to zero, clamp it to 0
  if (Math.abs(rounded) < Math.pow(10, -digits)) {
    rounded = 0;
  }

  // Explicitly normalize -0 to 0
  if (Object.is(rounded, -0) || isNaN(rounded)) {
    rounded = 0;
  }

  return rounded.toLocaleString(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: clamp ? digits : undefined
  });
};
