import {
  entryPayload,
  type BrewAdditionKind,
  type TempUnits
} from "@meadtools/brew-domain/entry-payload";
import { VOLUME_TO_L, type VolumeUnit } from "@meadtools/core/recipe";

import type { EnqueueEntryInput } from "./entry-outbox-record";
import { parseDecimalInput } from "./gravity-entry-form";

/**
 * Form logic for the non-gravity entry types. Each builder uses the shared
 * `entryPayload` builders so the request matches what the web app sends for
 * the same input. Validation is pure so it can be tested without React Native.
 */

export type FieldError = "empty" | "invalid" | "range";
export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: FieldError };

/** Sanity ranges that catch typos; the web accepts any finite value. */
export const TEMPERATURE_RANGES = {
  C: { min: -20, max: 110 },
  F: { min: -4, max: 230 }
} as const satisfies Record<"C" | "F", { min: number; max: number }>;

export const PH_RANGE = { min: 0, max: 14 } as const;

export function parseNumberField(
  text: string,
  range?: { min: number; max: number; exclusiveMin?: boolean }
): FieldResult<number> {
  if (!text.trim()) return { ok: false, error: "empty" };
  const value = parseDecimalInput(text);
  if (value === null) return { ok: false, error: "invalid" };
  if (range) {
    const belowMin = range.exclusiveMin ? value <= range.min : value < range.min;
    if (belowMin || value > range.max) return { ok: false, error: "range" };
  }
  return { ok: true, value };
}

function isoTime(measuredAt: Date) {
  return measuredAt.toISOString();
}

function noteOrNull(note: string) {
  return note.trim() || null;
}

// Temperature -----------------------------------------------------------

export type TemperatureUnit = Extract<TempUnits, "C" | "F">;

export function buildTemperatureInput({
  brewId,
  value,
  unit,
  note,
  measuredAt
}: {
  brewId: string;
  value: number;
  unit: TemperatureUnit;
  note: string;
  measuredAt: Date;
}): EnqueueEntryInput {
  const datetime = isoTime(measuredAt);
  return {
    brewId,
    payload: { ...entryPayload.temperature(value, unit, noteOrNull(note), datetime), datetime }
  };
}

// pH --------------------------------------------------------------------

export function buildPhInput({
  brewId,
  value,
  note,
  measuredAt
}: {
  brewId: string;
  value: number;
  note: string;
  measuredAt: Date;
}): EnqueueEntryInput {
  const datetime = isoTime(measuredAt);
  return { brewId, payload: { ...entryPayload.ph(value, noteOrNull(note), datetime), datetime } };
}

// Volume ----------------------------------------------------------------

/** The units offered by the web's volume dialog, grouped as it does. */
export const VOLUME_UNITS: readonly VolumeUnit[] = [
  "gal", "qt", "pt", "fl_oz",
  "L", "mL",
  "imp_gal", "imp_qt", "imp_pt", "imp_fl_oz"
];

export function preferredVolumeUnit(measurementSystem: string | null | undefined): VolumeUnit {
  if (measurementSystem === "us") return "gal";
  if (measurementSystem === "uk") return "imp_gal";
  return "L";
}

/**
 * Records the brew's current volume. The server sets the brew's current
 * volume from the latest `VOLUME` entry by time, so a single queued entry
 * is enough and an older offline reading cannot override a newer one.
 */
export function buildVolumeInput({
  brewId,
  value,
  unit,
  note,
  measuredAt
}: {
  brewId: string;
  value: number;
  unit: VolumeUnit;
  note: string;
  measuredAt: Date;
}): EnqueueEntryInput {
  const datetime = isoTime(measuredAt);
  return {
    brewId,
    payload: {
      ...entryPayload.volume({
        liters: value * VOLUME_TO_L[unit],
        displayValue: value,
        displayUnit: unit,
        note: noteOrNull(note),
        datetime
      }),
      datetime
    }
  };
}

// Note, tasting, issue ----------------------------------------------------

export type TextEntryType = "NOTE" | "TASTING" | "ISSUE";

/** Mirrors the web dialog: only notes take a custom title. */
export function buildTextEntryInput({
  brewId,
  type,
  title,
  note,
  measuredAt
}: {
  brewId: string;
  type: TextEntryType;
  title: string;
  note: string;
  measuredAt: Date;
}): EnqueueEntryInput {
  const datetime = isoTime(measuredAt);
  const text = note.trim();
  const payload =
    type === "NOTE"
      ? entryPayload.note(text, title.trim() || null, null, datetime)
      : type === "TASTING"
        ? entryPayload.tasting(text, "Tasting", datetime)
        : entryPayload.issue(text, "Issue", datetime);
  return { brewId, payload: { ...payload, datetime } };
}

// Additions -------------------------------------------------------------

/**
 * Manual additions offered on Mobile. Yeast pitching uses its own web flow
 * (packets/weight and Go-Ferm), so it is not offered as a free-form kind.
 */
export const MANUAL_ADDITION_KINDS = ["INGREDIENT", "NUTRIENT", "OTHER"] as const satisfies readonly BrewAdditionKind[];
export type ManualAdditionKind = (typeof MANUAL_ADDITION_KINDS)[number];

export const ADDITION_UNITS = [
  "g", "kg", "mg", "oz", "lb",
  "mL", "L", "tsp", "tbsp", "fl_oz", "gal",
  "units"
] as const;
export type AdditionUnit = (typeof ADDITION_UNITS)[number];

export type AdditionFields = {
  name: string;
  kind: ManualAdditionKind;
  amountText: string;
  unit: AdditionUnit;
};

export type AdditionResult =
  | { ok: true; name: string; amount: number | undefined }
  | { ok: false; field: "name" | "amount"; error: FieldError };

export function validateAddition(fields: AdditionFields): AdditionResult {
  const name = fields.name.trim();
  if (!name) return { ok: false, field: "name", error: "empty" };
  if (!fields.amountText.trim()) return { ok: true, name, amount: undefined };
  const amount = parseNumberField(fields.amountText, { min: 0, max: 1_000_000, exclusiveMin: true });
  if (!amount.ok) return { ok: false, field: "amount", error: amount.error };
  return { ok: true, name, amount: amount.value };
}

/**
 * Builds a manual, untracked addition like the web's `buildAddition`:
 * amounts rounded to six decimals, the typed name kept as `plannedName`, and
 * the brew's current stage recorded in `meta.stage` (the server uses it for
 * secondary-stage ABV estimates).
 */
export function buildAdditionInput({
  brewId,
  name,
  kind,
  amount,
  unit,
  note,
  stage,
  measuredAt
}: {
  brewId: string;
  name: string;
  kind: ManualAdditionKind;
  amount: number | undefined;
  unit: AdditionUnit;
  note: string;
  stage: string | null;
  measuredAt: Date;
}): EnqueueEntryInput {
  const datetime = isoTime(measuredAt);
  const payload = entryPayload.addition({
    name,
    kind,
    source: "manual",
    amount: amount === undefined ? undefined : Number(amount.toFixed(6)),
    unit: amount === undefined ? undefined : unit,
    note: noteOrNull(note),
    meta: { plannedName: name, ...(stage ? { stage } : {}) },
    datetime
  });
  return { brewId, payload: { ...payload, datetime } };
}
