import { convertReadingTemperature } from "@meadtools/brew-domain/hydrometer";
import type {
  HydrometerLogResponse,
  UpdateHydrometerLogRequestBody
} from "@meadtools/api-contract";
export const logNumberFields = [
  "gravity",
  "calculated_gravity",
  "temperature",
  "angle",
  "battery",
  "interval"
] as const;
export type LogDraft = Record<(typeof logNumberFields)[number], string> & {
  dateTime: string;
  temp_units: "C" | "F";
};
export function logDraft(log: HydrometerLogResponse): LogDraft {
  return {
    gravity: String(log.gravity),
    calculated_gravity: log.calculated_gravity === null ? "" : String(log.calculated_gravity),
    temperature: String(
      log.temp_units === "K"
        ? convertReadingTemperature(log.temperature, "K", "F")
        : log.temperature
    ),
    angle: String(log.angle),
    battery: String(log.battery),
    interval: String(log.interval),
    dateTime: log.datetime,
    temp_units: log.temp_units === "C" ? "C" : "F"
  };
}
export function parseLogDraft(draft: LogDraft): UpdateHydrometerLogRequestBody | null {
  if (!Number.isFinite(Date.parse(draft.dateTime))) return null;
  const numbers: Record<string, number> = {};
  for (const field of logNumberFields) {
    const text = draft[field].trim().replace(",", ".");
    if (field === "calculated_gravity" && text === "") {
      continue;
    }
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return null;
    const value = Number(text);
    if (
      !Number.isFinite(value) ||
      (field === "interval" && (!Number.isInteger(value) || value < 0))
    )
      return null;
    numbers[field] = value;
  }
  return { ...numbers, temp_units: draft.temp_units, dateTime: draft.dateTime };
}
