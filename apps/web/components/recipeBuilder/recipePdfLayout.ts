export const RECIPE_PDF_COLUMN_WIDTHS = {
  overview: [50, 50],
  metrics: [20, 20, 20, 20, 20],
  nutrients: [25, 25, 25, 25],
  split: [50, 50],
  ingredients: [80, 10, 10],
  notes: [50, 50],
  additives: [80, 20]
} as const;

export function toPercentageWidths(
  widths: readonly number[]
): `${number}%`[] {
  return widths.map((width): `${number}%` => `${width}%`);
}
