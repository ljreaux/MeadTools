import {
  entryPayload,
  type GravityEntryUnit,
  type GravityReadingRole
} from "@meadtools/brew-domain/entry-payload";
import { refractometerCorrectedSg, toBrix, toSG } from "@meadtools/core/gravity";

import type { EnqueueEntryInput } from "./entry-outbox-record";

/** Plausible manual reading ranges; they reject typos such as `1050`. */
export const GRAVITY_INPUT_RANGES = {
  SG: { min: 0.9, max: 1.3 },
  BRIX: { min: -5, max: 60 }
} as const satisfies Record<GravityEntryUnit, { min: number; max: number }>;

export type GravityInputError = "empty" | "invalid" | "range" | "factor";

export type GravityCorrection = {
  /** The user asked for refractometer correction. */
  apply: boolean;
  /** Correction factor as typed; the web default is `1`. */
  factorText: string;
  /** The brew's recorded original gravity, if any (see `findOriginalGravity`). */
  originalGravity: number | null;
};

export type GravityReading = {
  ok: true;
  enteredValue: number;
  unit: GravityEntryUnit;
  /** Specific gravity sent to the server. */
  sg: number;
  /** Present only when a refractometer correction was applied. */
  correction: { factor: number; originalGravity: number } | null;
};

export type GravityInputResult = GravityReading | { ok: false; error: GravityInputError };

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

/** A recorded OG usable for refractometer correction (the web requires > 1). */
export function hasUsableOriginalGravity(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 1;
}

/** Refractometer correction is offered only for °Bx with a recorded OG, as on the web. */
export function canCorrectRefractometer(unit: GravityEntryUnit, originalGravity: number | null) {
  return unit === "BRIX" && hasUsableOriginalGravity(originalGravity);
}

/**
 * Validates a manual reading and converts it to SG. A °Bx reading uses the
 * uncorrected `toSG` conversion unless refractometer correction applies, in
 * which case it uses the same `refractometerCorrectedSg` formula as the web.
 */
export function validateGravityInput(
  text: string,
  unit: GravityEntryUnit,
  correction?: GravityCorrection
): GravityInputResult {
  if (!text.trim()) return { ok: false, error: "empty" };
  const enteredValue = parseDecimalInput(text);
  if (enteredValue === null) return { ok: false, error: "invalid" };
  const range = GRAVITY_INPUT_RANGES[unit];
  if (enteredValue < range.min || enteredValue > range.max) {
    return { ok: false, error: "range" };
  }
  if (unit === "SG") {
    return { ok: true, enteredValue, unit, sg: enteredValue, correction: null };
  }

  const og = correction?.originalGravity ?? null;
  if (correction?.apply && canCorrectRefractometer(unit, og)) {
    const factor = parseDecimalInput(correction.factorText);
    if (factor === null || factor <= 0) return { ok: false, error: "factor" };
    return {
      ok: true,
      enteredValue,
      unit,
      sg: refractometerCorrectedSg(toBrix(og!), enteredValue, factor),
      correction: { factor, originalGravity: og! }
    };
  }
  return { ok: true, enteredValue, unit, sg: toSG(enteredValue), correction: null };
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

type GravityEntryLike = {
  type: string;
  datetime: string | null;
  gravity: number | null;
  data: unknown;
};

/**
 * The brew's actual OG, chosen like the web's stage data: the earliest
 * visible, measured-or-recipe `GRAVITY` entry with the `OG` role.
 */
export function findOriginalGravity(entries: readonly GravityEntryLike[]): number | null {
  let best: { time: number; gravity: number } | null = null;
  for (const entry of entries) {
    if (entry.type !== "GRAVITY") continue;
    if (typeof entry.gravity !== "number" || !Number.isFinite(entry.gravity)) continue;
    const data = (entry.data ?? {}) as { hidden?: unknown; source?: unknown; readingRole?: unknown };
    if (data.hidden || data.source === "nutrient_basis") continue;
    if (data.readingRole !== "OG") continue;
    const time = entry.datetime ? new Date(entry.datetime).getTime() : 0;
    const safeTime = Number.isFinite(time) ? time : 0;
    if (!best || safeTime < best.time) best = { time: safeTime, gravity: entry.gravity };
  }
  return best?.gravity ?? null;
}

/**
 * Builds the outbox input for a measured reading with the same display
 * metadata the web app stores for the same input.
 */
export function buildGravityEnqueueInput({
  brewId,
  reading,
  role = "GENERAL",
  note,
  measuredAt
}: {
  brewId: string;
  reading: GravityReading;
  role?: GravityReadingRole;
  note: string;
  measuredAt: Date;
}): EnqueueEntryInput {
  const corrected = reading.unit === "BRIX" && reading.correction !== null;
  const payload = entryPayload.gravity(reading.sg, note.trim() || null, {
    readingRole: role,
    source: "measured",
    datetime: measuredAt.toISOString(),
    display: {
      enteredValue: reading.enteredValue,
      enteredUnit: reading.unit,
      convertedGravity: reading.sg,
      refractometerCorrectionApplied: corrected,
      correctionFactor: corrected ? reading.correction!.factor : undefined,
      ogUsed: corrected ? reading.correction!.originalGravity : undefined
    }
  });
  return { brewId, payload: { ...payload, datetime: measuredAt.toISOString() } };
}
