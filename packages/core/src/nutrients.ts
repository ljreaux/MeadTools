import { toBrix } from "./gravity";
import { parseNumber } from "./numeric";

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
export type SelectedNutrients = Record<NutrientKey, boolean>;

export type NutrientData = {
  version: 2;
  inputs: {
    volume: string;
    volumeUnits: NutrientVolumeUnit;
    sg: string;
    offsetPpm: string;
    numberOfAdditions: string;
    goFermType: GoFermType;
    yeastAmountG: string;
    yeastAmountTouched: boolean;
  };
  selected: {
    yeastBrand: string;
    yeastStrain: string;
    yeastId?: number;
    nitrogenRequirement: NitrogenRequirement;
    schedule: NutrientScheduleType;
    selectedNutrients: SelectedNutrients;
  };
  settings: {
    yanContribution: Record<NutrientKey, string>;
    maxGpl: Record<NutrientKey, string>;
    maxGplTouched: boolean;
    other: { name: string; usesOrganicMultiplier: boolean };
  };
  adjustments: {
    adjustAllowed: boolean;
    providedYanPpm: Record<NutrientKey, string>;
  };
};

export type NutrientDerivedState = {
  targetYanPpm: number;
  remainingYanPpm: number;
  numberOfAdditions: number;
  nutrientAdditions: {
    totalGrams: Record<NutrientKey, number>;
    perAddition: Record<NutrientKey, number>;
  };
  providedYanPpm: Record<NutrientKey, number>;
  goFerm: {
    amount: number;
    water: number;
  };
};

const nutrientKeys: NutrientKey[] = ["fermO", "fermK", "dap", "other"];

const maxGplPresets: Record<
  NutrientScheduleType,
  string[] | string[][]
> = {
  tbe: ["0.45", "0.5", "0.96", "0"],
  tosna: ["2.5", "0", "0", "0"],
  justK: ["0", "3", "0", "0"],
  dap: ["0", "0", "1.5", "0"],
  oAndk: [
    ["0.6", "0.81", "0", "0"],
    ["0.9", "0.81", "0", "0"],
    ["1.1", "1", "0", "0"]
  ],
  oAndDap: ["1", "0", "0.96", "0"],
  kAndDap: ["0", "1", "0.96", "0"],
  other: ["0", "0", "0", "0"]
};

function valuesToRecord(values: string[]): Record<NutrientKey, string> {
  return {
    fermO: values[0] ?? "0",
    fermK: values[1] ?? "0",
    dap: values[2] ?? "0",
    other: values[3] ?? "0"
  };
}

export function initialNutrientData(
  patch?: Partial<NutrientData>
): NutrientData {
  const base: NutrientData = {
    version: 2,
    inputs: {
      volume: "1",
      volumeUnits: "gal",
      sg: "1",
      offsetPpm: "0",
      numberOfAdditions: "1",
      goFermType: "Go-Ferm",
      yeastAmountG: "",
      yeastAmountTouched: false
    },
    selected: {
      yeastBrand: "Lalvin",
      yeastStrain: "18-2007",
      nitrogenRequirement: "Low",
      schedule: "tosna",
      selectedNutrients: {
        fermO: true,
        fermK: false,
        dap: false,
        other: false
      }
    },
    settings: {
      yanContribution: {
        fermO: "40",
        fermK: "100",
        dap: "210",
        other: "0"
      },
      maxGpl: {
        fermO: "2.5",
        fermK: "0",
        dap: "0",
        other: "0"
      },
      maxGplTouched: false,
      other: { name: "", usesOrganicMultiplier: false }
    },
    adjustments: {
      adjustAllowed: false,
      providedYanPpm: {
        fermO: "0",
        fermK: "0",
        dap: "0",
        other: "0"
      }
    }
  };

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
      maxGpl: {
        ...base.settings.maxGpl,
        ...(patch?.settings?.maxGpl ?? {})
      },
      other: {
        ...base.settings.other,
        ...(patch?.settings?.other ?? {})
      }
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
}

export function getEffectiveMaxGpl(args: {
  schedule: NutrientScheduleType;
  sg: string;
  selected: SelectedNutrients;
}): Record<NutrientKey, string> {
  if (args.schedule === "other") {
    const values = {
      fermO: "0.45",
      fermK: "0.5",
      dap: "0.96",
      other: "1"
    };
    return {
      fermO: args.selected.fermO ? values.fermO : "0",
      fermK: args.selected.fermK ? values.fermK : "0",
      dap: args.selected.dap ? values.dap : "0",
      other: args.selected.other ? values.other : "0"
    };
  }

  const preset = maxGplPresets[args.schedule];
  if (typeof preset[0] === "string") return valuesToRecord(preset as string[]);

  const tiers = preset as string[][];
  const sg = parseNumber(args.sg);
  if (sg <= 1.08) return valuesToRecord(tiers[0] ?? []);
  if (sg <= 1.11) return valuesToRecord(tiers[1] ?? []);
  return valuesToRecord(tiers[2] ?? []);
}

function nitrogenMultiplier(requirement: NitrogenRequirement) {
  if (requirement === "Very Low" || requirement === "Low") return 0.75;
  if (requirement === "Medium") return 0.9;
  if (requirement === "High") return 1.25;
  return 1.8;
}

export function calculateNutrientTargetYanPpm(data: NutrientData) {
  const sg = parseNumber(data.inputs.sg);
  const offset = parseNumber(data.inputs.offsetPpm || "0");
  const gpl = toBrix(sg) * sg * 10;
  return Math.round(gpl * nitrogenMultiplier(data.selected.nitrogenRequirement) - offset);
}

function calculateAutoProvidedYanPpm(data: NutrientData) {
  let remaining = calculateNutrientTargetYanPpm(data);
  const organicMultiplier = data.inputs.goFermType === "none" ? 3 : 4;
  const contribution: Record<NutrientKey, number> = {
    fermO: parseNumber(data.settings.yanContribution.fermO) * organicMultiplier,
    fermK: parseNumber(data.settings.yanContribution.fermK),
    dap: parseNumber(data.settings.yanContribution.dap),
    other:
      parseNumber(data.settings.yanContribution.other) *
      (data.settings.other.usesOrganicMultiplier ? organicMultiplier : 1)
  };
  const provided: Record<NutrientKey, string> = {
    fermO: "0",
    fermK: "0",
    dap: "0",
    other: "0"
  };

  for (const key of nutrientKeys) {
    if (remaining <= 0) continue;
    const maximum = data.selected.selectedNutrients[key]
      ? parseNumber(data.settings.maxGpl[key])
      : 0;
    const capacity = (contribution[key] || 0) * (maximum || 0);
    if (capacity <= 0) continue;
    const use = Math.min(capacity, remaining);
    provided[key] = String(use);
    remaining -= use;
  }

  return provided;
}

function calculateAutoYeastAmountG(data: NutrientData) {
  const volume = parseNumber(data.inputs.volume);
  const sg = parseNumber(data.inputs.sg);
  let multiplier = data.inputs.volumeUnits === "liter" ? 1 / 3.78541 : 1;
  if (sg >= 1.125) multiplier *= 4;
  else if (sg > 1.1 && sg < 1.125) multiplier *= 3;
  else multiplier *= 2;
  return String(Math.round(volume * multiplier * 100) / 100);
}

export function calculateEffectiveNutrientData(
  data: NutrientData
): NutrientData {
  const maxGpl = data.settings.maxGplTouched
    ? data.settings.maxGpl
    : getEffectiveMaxGpl({
        schedule: data.selected.schedule,
        sg: data.inputs.sg,
        selected: data.selected.selectedNutrients
      });
  const withMaxGpl = {
    ...data,
    settings: { ...data.settings, maxGpl }
  };
  const providedYanPpm = withMaxGpl.adjustments.adjustAllowed
    ? withMaxGpl.adjustments.providedYanPpm
    : calculateAutoProvidedYanPpm(withMaxGpl);

  return {
    ...withMaxGpl,
    inputs: {
      ...withMaxGpl.inputs,
      yeastAmountG: withMaxGpl.inputs.yeastAmountTouched
        ? withMaxGpl.inputs.yeastAmountG
        : calculateAutoYeastAmountG(withMaxGpl)
    },
    adjustments: {
      ...withMaxGpl.adjustments,
      providedYanPpm
    }
  };
}

export function calculateNutrientDerivedState(
  data: NutrientData
): NutrientDerivedState {
  const volume = parseNumber(data.inputs.volume);
  const numberOfAdditions = Math.max(
    1,
    parseNumber(data.inputs.numberOfAdditions || "1")
  );
  const targetYanPpm = calculateNutrientTargetYanPpm(data);
  const providedYanPpm = Object.fromEntries(
    nutrientKeys.map((key) => [
      key,
      parseNumber(data.adjustments.providedYanPpm[key])
    ])
  ) as Record<NutrientKey, number>;
  const organicMultiplier = data.inputs.goFermType === "none" ? 3 : 4;
  const litersPerUnit = data.inputs.volumeUnits === "liter" ? 1 : 3.785;
  const totalGrams = Object.fromEntries(
    nutrientKeys.map((key) => {
      const baseContribution = parseNumber(data.settings.yanContribution[key]);
      const contribution =
        key === "fermO" ||
        (key === "other" && data.settings.other.usesOrganicMultiplier)
          ? baseContribution * organicMultiplier
          : baseContribution;
      const ppm = Math.max(0, providedYanPpm[key] || 0);
      return [key, (contribution === 0 ? 0 : ppm / contribution) * volume * litersPerUnit];
    })
  ) as Record<NutrientKey, number>;
  const perAddition = Object.fromEntries(
    nutrientKeys.map((key) => [key, totalGrams[key] / numberOfAdditions])
  ) as Record<NutrientKey, number>;
  const remainingYanPpm =
    targetYanPpm -
    nutrientKeys.reduce((sum, key) => sum + providedYanPpm[key], 0);
  const yeastAmount = parseNumber(data.inputs.yeastAmountG || "0");
  let goFermMultiplier = 0;
  let waterMultiplier = 20;
  if (data.inputs.goFermType === "none") waterMultiplier = 0;
  if (
    data.inputs.goFermType === "Go-Ferm" ||
    data.inputs.goFermType === "protect"
  ) {
    goFermMultiplier = 1.25;
  }
  if (data.inputs.goFermType === "sterol-flash") {
    goFermMultiplier = 1.2;
    waterMultiplier /= 2;
  }
  const goFermAmount = yeastAmount * goFermMultiplier;

  return {
    targetYanPpm,
    remainingYanPpm,
    numberOfAdditions,
    nutrientAdditions: { totalGrams, perAddition },
    providedYanPpm,
    goFerm: {
      amount: Math.round(goFermAmount * 100) / 100,
      water: Math.round(goFermAmount * waterMultiplier * 100) / 100
    }
  };
}
