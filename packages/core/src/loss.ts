import type { NormalizedIngredientLine } from "./recipe";

/**
 * A deliberately rough planning allowance for liquid left behind when the
 * primary ferment is transferred. The initial values are informed by 18
 * de-identified tracker records, none with a verified measured starting
 * volume, and must not be presented as a prediction of actual yield.
 *
 * The estimate applies only to primary liquid before secondary additions.
 * The 5% base covers lees and transfer handling. Solid primary fruit and
 * vegetables add 60 percentage points per unit of their modeled share of
 * primary volume. Juice, water, honey, and other liquids add no solid loss.
 */
export function estimatePrimaryLossPercentage(
  lines: NormalizedIngredientLine[],
): number | null {
  const primary = lines.filter((line) => !line.secondary);
  if (primary.some((line) => !Number.isFinite(line.volumeL) || line.volumeL < 0)) {
    return null;
  }

  const primaryVolumeL = primary.reduce((sum, line) => sum + line.volumeL, 0);
  if (!Number.isFinite(primaryVolumeL) || primaryVolumeL <= 0) return null;

  const solidVolumeL = solidIngredientVolumeL(primary);

  return Math.round(5 + 60 * (solidVolumeL / primaryVolumeL));
}

function solidIngredientVolumeL(lines: NormalizedIngredientLine[]): number {
  return lines.reduce((sum, line) => {
    const category = typeof line.category === "string"
      ? line.category.trim().toLowerCase()
      : "";
    // Some catalog juices are historically categorized as fruit. Their names
    // identify them as liquids without changing existing recipe or catalog data.
    const isJuice = /\bjuice\b/i.test(line.name ?? "");
    return !isJuice && (category === "fruit" || category === "dried fruit" || category === "vegetable")
      ? sum + line.volumeL
      : sum;
  }, 0);
}

/**
 * Optional, uncalibrated suggestion for losses after secondary additions.
 * Its solid-volume term follows the primary heuristic, but no paired
 * secondary-to-bottling measurements support the coefficients yet.
 */
export function estimateSecondaryLossPercentage(
  lines: NormalizedIngredientLine[],
  postLossPrimaryVolumeL: number,
): number | null {
  const secondary = lines.filter((line) => line.secondary);
  if (
    !Number.isFinite(postLossPrimaryVolumeL) ||
    postLossPrimaryVolumeL < 0 ||
    secondary.some((line) => !Number.isFinite(line.volumeL) || line.volumeL < 0)
  ) {
    return null;
  }

  const totalVolumeL = postLossPrimaryVolumeL +
    secondary.reduce((sum, line) => sum + line.volumeL, 0);
  if (!Number.isFinite(totalVolumeL) || totalVolumeL <= 0) return null;

  return Math.round(5 + 60 * (solidIngredientVolumeL(secondary) / totalVolumeL));
}

export function isValidLossPercentage(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value < 100;
}
