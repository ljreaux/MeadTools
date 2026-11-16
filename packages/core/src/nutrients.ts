import { toBrix } from "./gravity";
import { parseNumber } from "./numeric";
import { KG_TO_WEIGHT, type NormalizedIngredientLine } from "./recipe";

export function estimatePrimaryFruitYanOffset(
  ingredients: readonly Pick<NormalizedIngredientLine, "secondary" | "category" | "weightKg">[],
  primaryVolumeL: number
): number {
  const primaryVolumeGal = primaryVolumeL / 3.78541;
  if (!Number.isFinite(primaryVolumeGal) || primaryVolumeGal <= 0) return 0;
  const primaryFruitLb = ingredients
    .filter((line) => !line.secondary && line.category === "fruit")
    .reduce((sum, line) => sum + line.weightKg * KG_TO_WEIGHT.lb, 0);
  const offsetPpm = primaryFruitLb * 25 / primaryVolumeGal;
  return Number.isFinite(offsetPpm) ? Math.round(offsetPpm) : 0;
}


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

/** The schedule implied by the selected nutrients (matches the web calculator). */
export function scheduleFromSelected(selected: SelectedNutrients): NutrientScheduleType {
  if (selected.other) return "other";
  if (selected.fermO && selected.fermK && selected.dap) return "tbe";
  if (selected.fermO && selected.fermK) return "oAndk";
  if (selected.fermO && selected.dap) return "oAndDap";
  if (selected.fermK && selected.dap) return "kAndDap";
  if (selected.fermO) return "tosna";
  if (selected.fermK) return "justK";
  if (selected.dap) return "dap";
  return "other";
}

/** Max g/L for a preset that has none. */
export const DEFAULT_OTHER_NUTRIENT_MAX_GPL = "3";

/** The catalog fields the calculator needs from a yeast. */
export type NutrientYeastOption = {
  id: number;
  brand: string;
  name: string;
  nitrogen_requirement?: NitrogenRequirement;
};

/** The catalog fields the calculator needs from a nutrient preset. */
export type NutrientPresetOption = {
  name: string;
  yan_ppm_per_gpl: number;
  max_gpl: number | null;
  organic_multiplier: boolean;
};

/** Every change a nutrient calculator can make, shared by the web and Mobile. */
export type NutrientAction =
  | { type: "setVolume"; value: string }
  | { type: "setVolumeUnits"; value: NutrientVolumeUnit }
  | { type: "setSg"; value: string }
  | { type: "setOffsetPpm"; value: string }
  | { type: "setNumberOfAdditions"; value: string }
  | { type: "selectYeast"; yeast: NutrientYeastOption }
  | { type: "setYeastBrand"; brand: string; yeasts: readonly NutrientYeastOption[] }
  | { type: "setYeastStrain"; strain: string; yeasts: readonly NutrientYeastOption[] }
  | { type: "setNitrogenRequirement"; value: NitrogenRequirement }
  | { type: "toggleNutrient"; key: NutrientKey }
  | { type: "setOtherNutrientName"; value: string }
  | { type: "selectOtherNutrientPreset"; preset: NutrientPresetOption }
  | { type: "setOtherUsesOrganicMultiplier"; value: boolean }
  | { type: "setOtherYanContribution"; value: string }
  | { type: "setMaxGpl"; key: NutrientKey; value: string }
  | { type: "setYanContribution"; key: NutrientKey; value: string }
  | { type: "setAdjustAllowed"; value: boolean }
  | { type: "setProvidedYanPpm"; key: NutrientKey; value: string }
  | { type: "setGoFermType"; value: GoFermType }
  | { type: "setYeastAmountG"; value: string }
  | { type: "resetYeastAmountAuto" };

/**
 * Applies one calculator change. Picking a brand selects its first strain,
 * picking a strain or yeast syncs brand, id and nitrogen requirement, toggling
 * a nutrient recomputes the schedule, and a preset fills the Other nutrient.
 * Automatic fields are filled afterwards by `syncNutrientAutoFields`.
 */
export function applyNutrientAction(data: NutrientData, action: NutrientAction): NutrientData {
  const inputs = (patch: Partial<NutrientData["inputs"]>) => ({ ...data, inputs: { ...data.inputs, ...patch } });
  const selected = (patch: Partial<NutrientData["selected"]>) => ({ ...data, selected: { ...data.selected, ...patch } });
  const settings = (patch: Partial<NutrientData["settings"]>) => ({ ...data, settings: { ...data.settings, ...patch } });
  const adjustments = (patch: Partial<NutrientData["adjustments"]>) => ({
    ...data,
    adjustments: { ...data.adjustments, ...patch }
  });
  const fromYeast = (yeast: NutrientYeastOption | undefined, fallback: Partial<NutrientData["selected"]>) =>
    selected({
      ...fallback,
      yeastId: yeast?.id ?? data.selected.yeastId,
      nitrogenRequirement: yeast?.nitrogen_requirement ?? data.selected.nitrogenRequirement
    });

  switch (action.type) {
    case "setVolume":
      return inputs({ volume: action.value });
    case "setVolumeUnits":
      return inputs({ volumeUnits: action.value });
    case "setSg":
      return inputs({ sg: action.value });
    case "setOffsetPpm":
      return inputs({ offsetPpm: action.value });
    case "setNumberOfAdditions":
      return inputs({ numberOfAdditions: action.value });
    case "selectYeast":
      return fromYeast(action.yeast, { yeastBrand: action.yeast.brand, yeastStrain: action.yeast.name });
    case "setYeastBrand": {
      const first = action.yeasts.find((yeast) => yeast.brand === action.brand);
      return fromYeast(first, { yeastBrand: action.brand, yeastStrain: first?.name ?? data.selected.yeastStrain });
    }
    case "setYeastStrain": {
      const found = action.yeasts.find((yeast) => yeast.name === action.strain);
      return fromYeast(found, { yeastStrain: action.strain, yeastBrand: found?.brand ?? data.selected.yeastBrand });
    }
    case "setNitrogenRequirement":
      return selected({ nitrogenRequirement: action.value });
    case "toggleNutrient": {
      const selectedNutrients = {
        ...data.selected.selectedNutrients,
        [action.key]: !data.selected.selectedNutrients[action.key]
      };
      return selected({ selectedNutrients, schedule: scheduleFromSelected(selectedNutrients) });
    }
    case "setOtherNutrientName":
      return settings({ other: { ...data.settings.other, name: action.value } });
    case "selectOtherNutrientPreset":
      return settings({
        yanContribution: { ...data.settings.yanContribution, other: String(action.preset.yan_ppm_per_gpl) },
        maxGpl: {
          ...data.settings.maxGpl,
          other: action.preset.max_gpl == null ? DEFAULT_OTHER_NUTRIENT_MAX_GPL : String(action.preset.max_gpl)
        },
        maxGplTouched: true,
        other: { ...data.settings.other, name: action.preset.name, usesOrganicMultiplier: action.preset.organic_multiplier }
      });
    case "setOtherUsesOrganicMultiplier":
      return settings({ other: { ...data.settings.other, usesOrganicMultiplier: action.value } });
    case "setOtherYanContribution":
      return settings({ yanContribution: { ...data.settings.yanContribution, other: action.value } });
    case "setMaxGpl":
      return settings({ maxGplTouched: true, maxGpl: { ...data.settings.maxGpl, [action.key]: action.value } });
    case "setYanContribution":
      return settings({ yanContribution: { ...data.settings.yanContribution, [action.key]: action.value } });
    case "setAdjustAllowed":
      return adjustments({ adjustAllowed: action.value });
    case "setProvidedYanPpm":
      return adjustments({ providedYanPpm: { ...data.adjustments.providedYanPpm, [action.key]: action.value } });
    case "setGoFermType":
      return inputs({ goFermType: action.value });
    case "setYeastAmountG":
      return inputs({ yeastAmountG: action.value, yeastAmountTouched: true });
    case "resetYeastAmountAuto":
      return inputs({ yeastAmountTouched: false });
  }
}

const sameRecord = (a: Record<NutrientKey, string>, b: Record<NutrientKey, string>) =>
  nutrientKeys.every((key) => a[key] === b[key]);

/**
 * Writes the automatic fields into the data, as the web calculator shows them:
 * max g/L from the schedule (unless edited), the YAN split (unless adjusting)
 * and the yeast amount (unless typed). Returns the same object when nothing
 * changes, so callers can skip a state update.
 */
export function syncNutrientAutoFields(data: NutrientData): NutrientData {
  const effective = calculateEffectiveNutrientData(data);
  if (
    sameRecord(effective.settings.maxGpl, data.settings.maxGpl) &&
    sameRecord(effective.adjustments.providedYanPpm, data.adjustments.providedYanPpm) &&
    effective.inputs.yeastAmountG === data.inputs.yeastAmountG
  ) {
    return data;
  }
  return effective;
}
