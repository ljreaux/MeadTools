import { calcABV, toBrix } from "@meadtools/core/gravity";

export type HydrometerReading = {
  datetime: string;
  gravity: number;
  calculated_gravity: number | null;
  temperature: number;
  temp_units?: "C" | "F" | "K" | null;
  battery?: number | null;
};
export type HydrometerChartPoint = {
  date: string;
  gravity?: number;
  temperature?: number;
  battery?: number;
  abv?: number;
};
export type ChartSample = { date: string; value: number };
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function readingGravity(reading: Pick<HydrometerReading, "gravity" | "calculated_gravity">) {
  return finite(reading.calculated_gravity) ? reading.calculated_gravity : reading.gravity;
}

export function convertReadingTemperature(
  value: number,
  from: "C" | "F" | "K",
  to: "C" | "F" | "K"
) {
  const celsius = from === "F" ? ((value - 32) * 5) / 9 : from === "K" ? value - 273.15 : value;
  return to === "F" ? (celsius * 9) / 5 + 32 : to === "K" ? celsius + 273.15 : celsius;
}

/** Canonical SG; temperature is normalized before plotting mixed-unit readings. */
export function buildWirelessHydrometerChartData(
  logs: readonly HydrometerReading[],
  temperatureUnit?: "C" | "F" | "K"
): HydrometerChartPoint[] {
  const sorted = logs
    .filter((log) => Number.isFinite(Date.parse(log.datetime)))
    .sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime));
  const og = sorted.map(readingGravity).find(finite);
  return sorted
    .map((log) => {
      const gravity = readingGravity(log);
      return {
        date: log.datetime,
        gravity: finite(gravity) ? gravity : undefined,
        temperature: finite(log.temperature)
          ? temperatureUnit
            ? convertReadingTemperature(log.temperature, log.temp_units ?? "F", temperatureUnit)
            : log.temperature
          : undefined,
        battery: finite(log.battery) ? log.battery : undefined,
        ...(finite(og) && finite(gravity)
          ? { abv: Math.max(0, Math.round(calcABV(og, gravity) * 1000) / 1000) }
          : {})
      };
    })
    .filter((point) => finite(point.gravity) || finite(point.temperature) || finite(point.battery));
}

export function hydrometerMetricSamples(
  points: readonly HydrometerChartPoint[],
  metric: "gravity" | "temperature" | "battery" | "abv",
  gravityUnit: "SG" | "Brix" = "SG"
): ChartSample[] {
  return points.flatMap((point) => {
    const value = point[metric];
    return finite(value)
      ? [
          {
            date: point.date,
            value: metric === "gravity" && gravityUnit === "Brix" ? toBrix(value) : value
          }
        ]
      : [];
  });
}

/** Keep endpoints and both extremes in every bucket; full readings remain available. */
export function sampleChartExtrema(input: readonly ChartSample[], limit = 400): ChartSample[] {
  if (!Number.isInteger(limit) || limit < 4)
    throw new Error("Chart sample limit must be at least four");
  const points = input
    .filter((point) => finite(point.value) && Number.isFinite(Date.parse(point.date)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (points.length <= limit) return points;
  const buckets = Math.floor((limit - 2) / 2);
  const result = [points[0]];
  for (let bucket = 0; bucket < buckets; bucket++) {
    const start = 1 + Math.floor((bucket * (points.length - 2)) / buckets);
    const end = 1 + Math.floor(((bucket + 1) * (points.length - 2)) / buckets);
    let min = start;
    let max = start;
    for (let i = start + 1; i < end; i++) {
      if (points[i].value < points[min].value) min = i;
      if (points[i].value > points[max].value) max = i;
    }
    for (const index of [...new Set([min, max])].sort((a, b) => a - b)) result.push(points[index]);
  }
  result.push(points[points.length - 1]);
  return result;
}
