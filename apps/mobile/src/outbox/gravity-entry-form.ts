import type { GravityEntryUnit } from "@meadtools/brew-domain/entry-payload";
import { toBrix, toSG } from "@meadtools/core/gravity";

import type { EnqueueGravityInput } from "./gravity-outbox-record";

/** Plausible manual reading ranges; they reject typos such as `1050`. */
export const GRAVITY_INPUT_RANGES = {
  SG: { min: 0.9, max: 1.3 },
  BRIX: { min: -5, max: 60 }
} as const satisfies Record<GravityEntryUnit, { min: number; max: number }>;

export type GravityInputError = "empty" | "invalid" | "range";

export type GravityInputResult =
  | {
      ok: true;
      enteredValue: number;
      unit: GravityEntryUnit;
      /** Specific gravity sent to the server. */
      sg: number;
    }
  | { ok: false; error: GravityInputError };

/**
 * Parses a decimal typed with either `.` or `,` as the separator, so both
 * English (`1.050`) and German (`1,050`) keypads work. Gravity readings never
 * use thousands separators, so a lone comma is always a decimal separator.
 */
export function parseDecimalInput(text: string): number | null {
  const normalized = text.trim().replace(/\s+/g, "").replace("−", "-");
  if (!normalized) return null;
  if (normalized.includes(".") && normalized.includes(",")) return null;
  const decimal = normalized.replace(",", ".");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(decimal)) return null;
  const value = Number(decimal);
  return Number.isFinite(value) ? value : null;
}

/**
 * Validates a manual reading and converts it to SG with the same uncorrected
 * conversion the web app uses for a °Bx reading without refractometer
 * correction (`toSG`).
 */
export function validateGravityInput(
  text: string,
  unit: GravityEntryUnit
): GravityInputResult {
  if (!text.trim()) return { ok: false, error: "empty" };
  const enteredValue = parseDecimalInput(text);
  if (enteredValue === null) return { ok: false, error: "invalid" };
  const range = GRAVITY_INPUT_RANGES[unit];
  if (enteredValue < range.min || enteredValue > range.max) {
    return { ok: false, error: "range" };
  }
  const sg = unit === "SG" ? enteredValue : toSG(enteredValue);
  return { ok: true, enteredValue, unit, sg };
}

/**
 * Converts the typed value when the user switches units, matching the web
 * dialog's rounding. Returns the text unchanged when it is not a number.
 */
export function convertGravityText(
  text: string,
  from: GravityEntryUnit,
  to: GravityEntryUnit
): string {
  if (from === to) return text;
  const value = parseDecimalInput(text);
  if (value === null) return text;
  return to === "BRIX" ? toBrix(value).toFixed(2) : toSG(value).toFixed(3);
}

/**
 * Builds the outbox input for a general, measured, uncorrected reading. The
 * display metadata matches what the web app stores for the same input.
 */
export function buildGravityEnqueueInput({
  brewId,
  reading,
  note,
  measuredAt
}: {
  brewId: string;
  reading: Extract<GravityInputResult, { ok: true }>;
  note: string;
  measuredAt: Date;
}): EnqueueGravityInput {
  return {
    brewId,
    gravity: reading.sg,
    measuredAt,
    note: note.trim() || null,
    display: {
      enteredValue: reading.enteredValue,
      enteredUnit: reading.unit,
      convertedGravity: reading.sg,
      refractometerCorrectionApplied: false
    }
  };
}
