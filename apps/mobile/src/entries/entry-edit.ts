import type { BrewResponse, UpdateBrewEntryRequestBody } from "@meadtools/api-contract";
import { VOLUME_TO_L, type VolumeUnit } from "@meadtools/core/recipe";

import { ADDITION_UNITS, PH_RANGE, TEMPERATURE_RANGES, VOLUME_UNITS, parseNumberField } from "../outbox/entry-forms";
import { validateGravityInput } from "../outbox/gravity-entry-form";

/**
 * Online edits of saved timeline entries. A PATCH carries only the fields
 * the user changed, so a note-only edit never touches `data` and never
 * trips the server's inventory or bottling review guards. `data` is sent
 * as the full merged object because the server replaces it wholesale.
 */

export type SavedEntry = BrewResponse["entries"][number];

export type EditKind = "gravity" | "temperature" | "ph" | "volume" | "addition" | "text" | "noteOnly";

export type EditFields = {
  note: string;
  title: string;
  valueText: string;
  unit: string;
  name: string;
};

export type EditResult =
  | { ok: true; body: UpdateBrewEntryRequestBody; changed: boolean }
  | { ok: false; field: "value" | "name" | "note"; error: "empty" | "invalid" | "range" };

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const plain = (value: number) => String(Number(value.toFixed(6)));

/** Which values an entry type can edit on Mobile; others edit their note only. */
export function editKind(entry: SavedEntry): EditKind {
  const data = object(entry.data);
  switch (entry.type) {
    case "GRAVITY":
      return finite(entry.gravity) && data.source !== "abv_estimate" ? "gravity" : "noteOnly";
    case "TEMPERATURE":
      return finite(entry.temperature) && (entry.temp_units === "C" || entry.temp_units === "F")
        ? "temperature"
        : "noteOnly";
    case "PH":
      return finite(data.ph) ? "ph" : "noteOnly";
    case "VOLUME":
      return finite(data.liters) ? "volume" : "noteOnly";
    case "ADDITION":
      return typeof data.name === "string" && !Array.isArray(object(data.meta).components)
        ? "addition"
        : "noteOnly";
    case "NOTE":
    case "TASTING":
    case "ISSUE":
      return "text";
    default:
      return "noteOnly";
  }
}

/** Stage changes keep their history; everything else can be deleted online. */
export function canDeleteEntry(entry: SavedEntry) {
  return entry.type !== "STAGE_CHANGE";
}

export function initialEditFields(entry: SavedEntry): EditFields {
  const data = object(entry.data);
  const base = { note: entry.note ?? "", title: entry.title ?? "", valueText: "", unit: "", name: "" };
  switch (editKind(entry)) {
    case "gravity":
      return { ...base, valueText: (entry.gravity as number).toFixed(3), unit: "SG" };
    case "temperature":
      return { ...base, valueText: plain(entry.temperature as number), unit: entry.temp_units as string };
    case "ph":
      return { ...base, valueText: plain(data.ph as number) };
    case "volume": {
      const displayUnit = data.displayUnit;
      const usesDisplay = finite(data.displayValue) && typeof displayUnit === "string" &&
        (VOLUME_UNITS as readonly string[]).includes(displayUnit);
      return usesDisplay
        ? { ...base, valueText: plain(data.displayValue as number), unit: displayUnit as string }
        : { ...base, valueText: plain(data.liters as number), unit: "L" };
    }
    case "addition":
      return {
        ...base,
        name: data.name as string,
        valueText: finite(data.amount) ? plain(data.amount) : "",
        unit: typeof data.unit === "string" ? data.unit : "g"
      };
    default:
      return base;
  }
}

/** Units offered when editing an addition, keeping a legacy unit if present. */
export function additionEditUnits(current: string): string[] {
  const units: string[] = [...ADDITION_UNITS];
  return current && !units.includes(current) ? [current, ...units] : units;
}

/**
 * Builds the PATCH body from the original entry, the initial fields and the
 * edited fields. Unchanged fields are omitted.
 */
export function buildEntryUpdate(entry: SavedEntry, initial: EditFields, fields: EditFields): EditResult {
  const kind = editKind(entry);
  const data = object(entry.data);
  const body: UpdateBrewEntryRequestBody = {};

  if (fields.note !== initial.note) {
    if (kind === "text" && !fields.note.trim()) return { ok: false, field: "note", error: "empty" };
    body.note = fields.note.trim() || null;
  }
  if (kind === "text" && entry.type === "NOTE" && fields.title !== initial.title) {
    body.title = fields.title.trim() || null;
  }

  const valueChanged = fields.valueText.trim() !== initial.valueText.trim() || fields.unit !== initial.unit;
  switch (kind) {
    case "gravity": {
      if (!valueChanged) break;
      const reading = validateGravityInput(fields.valueText, "SG");
      if (!reading.ok) return { ok: false, field: "value", error: reading.error === "factor" ? "invalid" : reading.error };
      body.gravity = reading.sg;
      body.data = {
        ...data,
        display: {
          enteredValue: reading.enteredValue,
          enteredUnit: "SG",
          convertedGravity: reading.sg,
          refractometerCorrectionApplied: false
        }
      };
      break;
    }
    case "temperature": {
      if (!valueChanged) break;
      const unit = fields.unit === "C" ? "C" : "F";
      const result = parseNumberField(fields.valueText, TEMPERATURE_RANGES[unit]);
      if (!result.ok) return { ok: false, field: "value", error: result.error };
      body.temperature = result.value;
      body.temp_units = unit;
      break;
    }
    case "ph": {
      if (!valueChanged) break;
      const result = parseNumberField(fields.valueText, PH_RANGE);
      if (!result.ok) return { ok: false, field: "value", error: result.error };
      body.data = { ...data, ph: result.value };
      break;
    }
    case "volume": {
      if (!valueChanged) break;
      const result = parseNumberField(fields.valueText, { min: 0, max: 100_000, exclusiveMin: true });
      if (!result.ok) return { ok: false, field: "value", error: result.error };
      const unit = fields.unit as VolumeUnit;
      body.data = { ...data, liters: result.value * VOLUME_TO_L[unit], displayValue: result.value, displayUnit: unit };
      break;
    }
    case "addition": {
      const name = fields.name.trim();
      if (!valueChanged && name === initial.name.trim()) break;
      if (!name) return { ok: false, field: "name", error: "empty" };
      let amount: number | undefined;
      if (fields.valueText.trim()) {
        const result = parseNumberField(fields.valueText, { min: 0, max: 1_000_000, exclusiveMin: true });
        if (!result.ok) return { ok: false, field: "value", error: result.error };
        amount = Number(result.value.toFixed(6));
      }
      const { amount: _amount, unit: _unit, ...rest } = data;
      body.data = {
        ...rest,
        name,
        ...(amount === undefined ? {} : { amount, unit: fields.unit })
      };
      if (name !== initial.name.trim()) body.title = name;
      break;
    }
  }

  return { ok: true, body, changed: Object.keys(body).length > 0 };
}

/**
 * True when the server saved an edit or delete of a stock-tracked entry
 * without changing the recorded stock (for example after premium lapsed), so
 * that stock now needs review. Mirrors the web's notice after the same change.
 */
export function needsStockReview(outcome: { status?: string } | null | undefined) {
  return outcome?.status === "reconciliation_required";
}
