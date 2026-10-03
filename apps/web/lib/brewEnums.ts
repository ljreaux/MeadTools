import type {
  BrewEntryTypeResponse,
  BrewStageResponse
} from "@meadtools/api-contract";

export const BREW_STAGE = {
  PLANNED: "PLANNED",
  PRIMARY: "PRIMARY",
  SECONDARY: "SECONDARY",
  BULK_AGE: "BULK_AGE",
  STABILIZED: "STABILIZED",
  BACKSWEETENED: "BACKSWEETENED",
  PACKAGED: "PACKAGED",
  COMPLETE: "COMPLETE"
} as const satisfies Record<BrewStageResponse, BrewStageResponse>;

export type BrewStage = (typeof BREW_STAGE)[keyof typeof BREW_STAGE];

// The web tracker uses six panels. Stabilized and backsweetened brews remain
// in the bulk-aging panel while their actual stage is shown in the heading.
export type BrewTrackerStage = Exclude<
  BrewStage,
  "STABILIZED" | "BACKSWEETENED"
>;

export function getBrewTrackerStage(stage: BrewStage): BrewTrackerStage {
  return stage === "STABILIZED" || stage === "BACKSWEETENED"
    ? "BULK_AGE"
    : stage;
}

export const BREW_ENTRY_TYPE = {
  NOTE: "NOTE",
  TASTING: "TASTING",
  ISSUE: "ISSUE",
  GRAVITY: "GRAVITY",
  VOLUME: "VOLUME",
  TEMPERATURE: "TEMPERATURE",
  PH: "PH",
  STAGE_CHANGE: "STAGE_CHANGE",
  PACKAGING: "PACKAGING",
  ADDITION: "ADDITION",
  NUTRIENT: "NUTRIENT",
  RACKING: "RACKING",
  STABILIZATION: "STABILIZATION",
  BACKSWEETENING: "BACKSWEETENING"
} as const satisfies Record<BrewEntryTypeResponse, BrewEntryTypeResponse>;

export type BrewEntryType =
  (typeof BREW_ENTRY_TYPE)[keyof typeof BREW_ENTRY_TYPE];

export const TEMP_UNITS = {
  F: "F",
  C: "C"
} as const;

export type TempUnits = (typeof TEMP_UNITS)[keyof typeof TEMP_UNITS];

export const GRAVITY_UNITS = {
  SG: "SG",
  BRIX: "BRIX"
} as const;

export type GravityUnit = (typeof GRAVITY_UNITS)[keyof typeof GRAVITY_UNITS];
