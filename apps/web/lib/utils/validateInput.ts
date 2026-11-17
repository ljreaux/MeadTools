export { isValidNumber, parseNumber } from "@meadtools/core/numeric";
import { roundForDisplay } from "@meadtools/core/numeric";

export const normalizeNumberString = (
  num: number,
  digits: number,
  locale?: string,
  clamp?: boolean
) =>
  roundForDisplay(num, digits).toLocaleString(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: clamp ? digits : undefined
  });
