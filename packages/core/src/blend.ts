import { parseNumber } from "./numeric";

export type BlendingArray = [
  value: string | number,
  volume: string | number
][];

/** @deprecated Use `BlendingArray`. */
export type blendingArr = BlendingArray;

export function blendValues(values: BlendingArray) {
  const { numerator, denominator } = values.reduce(
    (accumulator, [rawValue, rawVolume]) => {
      const value = parseNumber(rawValue);
      const volume = parseNumber(rawVolume);

      return {
        numerator:
          accumulator.numerator + (volume > 0 ? value * volume : 0),
        denominator: accumulator.denominator + volume
      };
    },
    { numerator: 0, denominator: 0 }
  );

  return {
    blendedValue: denominator ? numerator / denominator : 0,
    totalVolume: denominator
  };
}
