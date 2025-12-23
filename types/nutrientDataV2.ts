// nutrientDataV2.ts

import { parseNumber } from "@/lib/utils/validateInput";

export type NutrientVolumeUnit = "gal" | "liter";
export type GoFermType = "Go-Ferm" | "protect" | "sterol-flash" | "none";

export type NitrogenRequirement =
  | "Very Low"
  | "Low"
  | "Medium"
  | "High"
  | "Very High";

export type NutrientScheduleType =
  | "tbe"
  | "tosna"
  | "justK"
  | "dap"
  | "oAndk"
  | "oAndDap"
  | "kAndDap"
  | "other";

export type NutrientKey = "fermO" | "fermK" | "dap" | "other";

export type SelectedNutrientsV2 = {
  fermO: boolean;
  fermK: boolean;
  dap: boolean;
  other: boolean;
};

export type NumericInputString = string;

export type NutrientAdjustmentsV2 = {
  adjustAllowed: boolean;
  providedYanPpm: Record<NutrientKey, NumericInputString>;
};

export type NutrientSettingsV2 = {
  yanContribution: Record<NutrientKey, NumericInputString>;
  maxGpl: Record<NutrientKey, NumericInputString>;
  maxGplTouched: boolean;
  other: { name: string };
};

export type NutrientInputsV2 = {
  volume: NumericInputString;
  volumeUnits: NutrientVolumeUnit;
  sg: NumericInputString;
  offsetPpm: NumericInputString;
  numberOfAdditions: NumericInputString;

  goFermType: GoFermType;

  yeastAmountG: NumericInputString;
  yeastAmountTouched: boolean;
};

export type NutrientSelectedV2 = {
  yeastBrand: string;
  yeastStrain: string;
  yeastId?: number;
  nitrogenRequirement: NitrogenRequirement;

  schedule: NutrientScheduleType;
  selectedNutrients: SelectedNutrientsV2;
};

export type NutrientDataV2 = {
  version: 2;
  inputs: NutrientInputsV2;
  selected: NutrientSelectedV2;
  settings: NutrientSettingsV2;
  adjustments: NutrientAdjustmentsV2;
};

export const initialSelectedNutrientsV2 = (
  patch?: Partial<SelectedNutrientsV2>
): SelectedNutrientsV2 => ({
  fermO: true,
  fermK: false,
  dap: false,
  other: false,
  ...patch
});

const zeros = (): Record<NutrientKey, NumericInputString> => ({
  fermO: "0",
  fermK: "0",
  dap: "0",
  other: "0"
});

/**
 * Defaults match your old provider:
 * - 1 gal
 * - SG 1.000
 * - offset 0
 * - 1 addition
 * - schedule tosna (Fermaid O only)
 * - Go-Ferm type "Go-Ferm"
 */
export const initialNutrientDataV2 = (
  patch?: Partial<NutrientDataV2>
): NutrientDataV2 => {
  const base: NutrientDataV2 = {
    version: 2,

    inputs: {
      volume: "1",
      volumeUnits: "gal",
      sg: "1",
      offsetPpm: "0",
      numberOfAdditions: "1",

      goFermType: "Go-Ferm",

      yeastAmountG: "", // blank until computed (or user types)
      yeastAmountTouched: false
    },

    selected: {
      yeastBrand: "Lalvin",
      yeastStrain: "18-2007",
      yeastId: undefined,
      nitrogenRequirement: "Low",

      schedule: "tosna",
      selectedNutrients: initialSelectedNutrientsV2()
    },

    settings: {
      // old defaults: ["40","100","210","0"]
      yanContribution: {
        fermO: "40",
        fermK: "100",
        dap: "210",
        other: "0"
      },

      // reasonable baseline defaults (these will get replaced by schedule presets later)
      // These correspond to your old maxGpl.tosna.value: ["2.5","0","0","0"]
      maxGpl: {
        fermO: "2.5",
        fermK: "0",
        dap: "0",
        other: "0"
      },
      maxGplTouched: false,
      other: { name: "" }
    },

    adjustments: {
      adjustAllowed: false,
      providedYanPpm: zeros()
    }
  };

  // shallow-ish merge that preserves nested objects unless you override them
  return {
    ...base,
    ...patch,
    inputs: { ...base.inputs, ...(patch?.inputs ?? {}) },
    selected: { ...base.selected, ...(patch?.selected ?? {}) },
    settings: {
      ...base.settings,
      ...(patch?.settings ?? {}),
      yanContribution: {
        ...base.settings.yanContribution,
        ...(patch?.settings?.yanContribution ?? {})
      },
      maxGpl: { ...base.settings.maxGpl, ...(patch?.settings?.maxGpl ?? {}) },
      other: { ...base.settings.other, ...(patch?.settings?.other ?? {}) }
    },
    adjustments: {
      ...base.adjustments,
      ...(patch?.adjustments ?? {}),
      providedYanPpm: {
        ...base.adjustments.providedYanPpm,
        ...(patch?.adjustments?.providedYanPpm ?? {})
      }
    }
  };
};
export const scheduleFromSelected = (
  s: SelectedNutrientsV2
): NutrientScheduleType => {
  if (s.other) return "other";
  if (s.fermO && s.fermK && s.dap) return "tbe";
  if (s.fermO && s.fermK) return "oAndk";
  if (s.fermO && s.dap) return "oAndDap";
  if (s.fermK && s.dap) return "kAndDap";
  if (s.fermO) return "tosna";
  if (s.fermK) return "justK";
  if (s.dap) return "dap";
  return "other";
};

type MaxGplEntryV2 = {
  value: string[] | string[][];
};

export const MAX_GPL_PRESETS: Record<NutrientScheduleType, MaxGplEntryV2> = {
  tbe: { value: ["0.45", "0.5", "0.96", "0"] },
  tosna: { value: ["2.5", "0", "0", "0"] },
  justK: { value: ["0", "3", "0", "0"] },
  dap: { value: ["0", "0", "1.5", "0"] },

  oAndk: {
    value: [
      ["0.6", "0.81", "0", "0"],
      ["0.9", "0.81", "0", "0"],
      ["1.1", "1", "0", "0"]
    ]
  },

  oAndDap: { value: ["1", "0", "0.96", "0"] },
  kAndDap: { value: ["0", "1", "0.96", "0"] },

  other: { value: ["0", "0", "0", "0"] }
};
export const ORDER: NutrientKey[] = ["fermO", "fermK", "dap", "other"];

function arrToRecord(arr: string[]): Record<NutrientKey, string> {
  return {
    fermO: arr[0] ?? "0",
    fermK: arr[1] ?? "0",
    dap: arr[2] ?? "0",
    other: arr[3] ?? "0"
  };
}

export function getEffectiveMaxGpl(params: {
  schedule: NutrientDataV2["selected"]["schedule"];
  sg: string;
  selected: NutrientDataV2["selected"]["selectedNutrients"];
}): Record<NutrientKey, string> {
  const { schedule, sg, selected } = params;

  // Old special-case: schedule === "other" uses fixed g/L per selected nutrient
  if (schedule === "other") {
    const nutrientValues: Record<NutrientKey, string> = {
      fermO: "0.45",
      fermK: "0.5",
      dap: "0.96",
      other: "1"
    };

    return {
      fermO: selected.fermO ? nutrientValues.fermO : "0",
      fermK: selected.fermK ? nutrientValues.fermK : "0",
      dap: selected.dap ? nutrientValues.dap : "0",
      other: selected.other ? nutrientValues.other : "0"
    };
  }

  const entry = MAX_GPL_PRESETS[schedule]?.value ?? ["0", "0", "0", "0"];

  // flat schedule
  if (typeof entry[0] === "string") {
    return arrToRecord(entry as string[]);
  }

  // tiered schedule (old thresholds)
  const og = parseNumber(sg);
  const tiers = entry as string[][];

  if (og <= 1.08) return arrToRecord(tiers[0] ?? ["0", "0", "0", "0"]);
  if (og <= 1.11) return arrToRecord(tiers[1] ?? ["0", "0", "0", "0"]);
  return arrToRecord(tiers[2] ?? ["0", "0", "0", "0"]);
}
