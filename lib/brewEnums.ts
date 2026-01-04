export const BREW_STAGE = {
  PLANNED: "PLANNED",
  PRIMARY: "PRIMARY",
  SECONDARY: "SECONDARY",
  BULK_AGE: "BULK_AGE",
  PACKAGED: "PACKAGED",
  COMPLETE: "COMPLETE"
} as const;

export type BrewStage = (typeof BREW_STAGE)[keyof typeof BREW_STAGE];

export const BREW_ENTRY_TYPE = {
  NOTE: "NOTE",
  TASTING: "TASTING",
  ISSUE: "ISSUE",
  GRAVITY: "GRAVITY",
  TEMPERATURE: "TEMPERATURE",
  PH: "PH",
  STAGE_CHANGE: "STAGE_CHANGE"
  // later:
  // ADDITION: "ADDITION",
  // NUTRIENT: "NUTRIENT",
  // etc...
} as const;

export type BrewEntryType =
  (typeof BREW_ENTRY_TYPE)[keyof typeof BREW_ENTRY_TYPE];

export const TEMP_UNITS = {
  F: "F",
  C: "C"
} as const;

export type TempUnits = (typeof TEMP_UNITS)[keyof typeof TEMP_UNITS];
