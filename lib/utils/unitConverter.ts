export const calcABV = (OG: number, FG: number) => {
  const OE = -668.962 + 1262.45 * OG - 776.43 * OG ** 2 + 182.94 * OG ** 3;
  const AE = -668.962 + 1262.45 * FG - 776.43 * FG ** 2 + 182.94 * FG ** 3;
  const q = 0.22 + 0.001 * OE;
  const RE = (q * OE + AE) / (1 + q);
  const ABW = (OE - RE) / (2.0665 - 0.010665 * OE);
  const ABV = ABW * (FG / 0.794);
  return ABV;
};

export const toBrix = (value: number) => {
  return -668.962 + 1262.45 * value - 776.43 * value ** 2 + 182.94 * value ** 3;
};

export const toSG = (gravityReading: number) => {
  return (
    1.00001 +
    0.0038661 * gravityReading +
    1.3488 * 10 ** -5 * gravityReading ** 2 +
    4.3074 * 10 ** -8 * gravityReading ** 3
  );
};

export function calcSb(SG: number) {
  const afterDecimal = SG - 1;
  return 1 + Math.round((afterDecimal * 2000) / 3) / 1000;
}
