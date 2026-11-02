import { z } from "zod";

const endpoint = z.strictObject({
  datetime: z.iso.datetime({ offset: true }),
  gravitySg: z.number().finite(),
});

export const manualGravityChangeSchema = z.strictObject({
  coverage: z.literal("returned_manual_page"),
  measurementCount: z.number().int().nonnegative(),
  first: endpoint.nullable(),
  last: endpoint.nullable(),
  netChangeSg: z.number().finite().nullable(),
  direction: z.enum(["decreased", "increased", "unchanged"]).nullable(),
  stabilityAssessment: z.literal("not_assessed"),
  activityAssessment: z.literal("not_assessed"),
});

/** Compare recorded measurements only; pagination and fermentation conclusions stay separate. */
export function summarizeManualGravityChange(entries: ReadonlyArray<{
  type: string;
  datetime: string;
  provenance: string;
  gravity?: number | null;
}>) {
  const measured = entries
    .filter((entry) => entry.type === "GRAVITY" && entry.provenance === "measured" &&
      typeof entry.gravity === "number" && Number.isFinite(entry.gravity) &&
      Number.isFinite(Date.parse(entry.datetime)))
    .map((entry) => ({ datetime: entry.datetime, gravitySg: entry.gravity! }))
    .sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime));
  const first = measured.at(0) ?? null;
  const last = measured.at(-1) ?? null;
  // Equal timestamps do not establish a temporal change, even if their values differ.
  const change = first && last && Date.parse(last.datetime) > Date.parse(first.datetime)
    ? last.gravitySg - first.gravitySg : null;
  return manualGravityChangeSchema.parse({
    coverage: "returned_manual_page",
    measurementCount: measured.length,
    first, last, netChangeSg: change,
    direction: change === null ? null : change < 0 ? "decreased" : change > 0 ? "increased" : "unchanged",
    stabilityAssessment: "not_assessed",
    activityAssessment: "not_assessed",
  });
}
