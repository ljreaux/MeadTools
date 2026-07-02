export { isValidNumber, parseNumber } from "@meadtools/core/numeric";

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
