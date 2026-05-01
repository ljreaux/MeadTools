import {
  getEffectiveMaxGpl,
  NutrientData,
  NutrientKey
} from "@/types/nutrientData";
import { toBrix } from "@/lib/utils/unitConverter";
import { parseNumber } from "@/lib/utils/validateInput";

export type NutrientAdditionsDerived = {
  totalGrams: Record<NutrientKey, number>;
  perAddition: Record<NutrientKey, number>;
};

export type NutrientDerivedState = {
  targetYanPpm: number;
  remainingYanPpm: number;
  numberOfAdditions: number;
  nutrientAdditions: NutrientAdditionsDerived;
  providedYanPpm: Record<NutrientKey, number>;
  goFerm: {
    amount: number;
    water: number;
  };
};

const nutrientKeys: NutrientKey[] = ["fermO", "fermK", "dap", "other"];

function getNitrogenMultiplier(
  nitrogenRequirement: NutrientData["selected"]["nitrogenRequirement"]
) {
  if (nitrogenRequirement === "Very Low") return 0.75;
  if (nitrogenRequirement === "Low") return 0.75;
  if (nitrogenRequirement === "Medium") return 0.9;
  if (nitrogenRequirement === "High") return 1.25;
  return 1.8;
}

export function calculateNutrientTargetYanPpm(data: NutrientData) {
  const sg = parseNumber(data.inputs.sg);
  const offset = parseNumber(data.inputs.offsetPpm || "0");
  const multiplier = getNitrogenMultiplier(data.selected.nitrogenRequirement);
  const gpl = toBrix(sg) * sg * 10;

  return Math.round(gpl * multiplier - offset);
}

function calculateAutoProvidedYanPpm(data: NutrientData) {
  let remaining = calculateNutrientTargetYanPpm(data);
  const organicMultiplier = data.inputs.goFermType === "none" ? 3 : 4;
  const yanContribution: Record<NutrientKey, number> = {
    fermO: parseNumber(data.settings.yanContribution.fermO) * organicMultiplier,
    fermK: parseNumber(data.settings.yanContribution.fermK),
    dap: parseNumber(data.settings.yanContribution.dap),
    other: parseNumber(data.settings.yanContribution.other)
  };

  const maxGpl = {
    fermO: data.selected.selectedNutrients.fermO
      ? parseNumber(data.settings.maxGpl.fermO)
      : 0,
    fermK: data.selected.selectedNutrients.fermK
      ? parseNumber(data.settings.maxGpl.fermK)
      : 0,
    dap: data.selected.selectedNutrients.dap
      ? parseNumber(data.settings.maxGpl.dap)
      : 0,
    other: data.selected.selectedNutrients.other
      ? parseNumber(data.settings.maxGpl.other)
      : 0
  };

  const nextProvided: Record<NutrientKey, string> = {
    fermO: "0",
    fermK: "0",
    dap: "0",
    other: "0"
  };

  nutrientKeys.forEach((key) => {
    if (remaining <= 0) return;

    const cap = (yanContribution[key] || 0) * (maxGpl[key] || 0);
    if (cap <= 0) return;

    const use = Math.min(cap, remaining);
    nextProvided[key] = String(use);
    remaining -= use;
  });

  return nextProvided;
}

function calculateAutoYeastAmountG(data: NutrientData) {
  const units = data.inputs.volumeUnits;
  const volume = parseNumber(data.inputs.volume);
  const sg = parseNumber(data.inputs.sg);

  let multiplier = 1;
  if (units === "liter") multiplier /= 3.78541;

  if (sg >= 1.125) multiplier *= 4;
  else if (sg > 1.1 && sg < 1.125) multiplier *= 3;
  else multiplier *= 2;

  return String(Math.round(volume * multiplier * 100) / 100);
}

export function calculateEffectiveNutrientData(data: NutrientData): NutrientData {
  const maxGpl = data.settings.maxGplTouched
    ? data.settings.maxGpl
    : getEffectiveMaxGpl({
        schedule: data.selected.schedule,
        sg: data.inputs.sg,
        selected: data.selected.selectedNutrients
      });

  const withMaxGpl: NutrientData = {
    ...data,
    settings: {
      ...data.settings,
      maxGpl
    }
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

export default function calculateNutrientDerivedState(
  data: NutrientData
): NutrientDerivedState {
  const volume = parseNumber(data.inputs.volume);
  const numberOfAdditions = Math.max(
    1,
    parseNumber(data.inputs.numberOfAdditions || "1")
  );
  const targetYanPpm = calculateNutrientTargetYanPpm(data);

  const providedYanPpm: Record<NutrientKey, number> = {
    fermO: parseNumber(data.adjustments.providedYanPpm.fermO),
    fermK: parseNumber(data.adjustments.providedYanPpm.fermK),
    dap: parseNumber(data.adjustments.providedYanPpm.dap),
    other: parseNumber(data.adjustments.providedYanPpm.other)
  };

  const yanContribution = {
    fermO: parseNumber(data.settings.yanContribution.fermO),
    fermK: parseNumber(data.settings.yanContribution.fermK),
    dap: parseNumber(data.settings.yanContribution.dap),
    other: parseNumber(data.settings.yanContribution.other)
  };

  const organicMultiplier = data.inputs.goFermType === "none" ? 3 : 4;
  const effectiveYanContribution = {
    ...yanContribution,
    fermO: yanContribution.fermO * organicMultiplier
  };
  const litersPerUnit = data.inputs.volumeUnits === "liter" ? 1 : 3.785;

  const totalGrams: Record<NutrientKey, number> = {
    fermO: 0,
    fermK: 0,
    dap: 0,
    other: 0
  };

  nutrientKeys.forEach((key) => {
    const ppm = Math.max(0, providedYanPpm[key] || 0);
    const contrib = effectiveYanContribution[key] || 0;
    const gPerLiter = contrib === 0 ? 0 : ppm / contrib;
    totalGrams[key] = gPerLiter * volume * litersPerUnit;
  });

  const perAddition: Record<NutrientKey, number> = {
    fermO: totalGrams.fermO / numberOfAdditions,
    fermK: totalGrams.fermK / numberOfAdditions,
    dap: totalGrams.dap / numberOfAdditions,
    other: totalGrams.other / numberOfAdditions
  };

  const remainingYanPpm =
    targetYanPpm -
    (providedYanPpm.fermO +
      providedYanPpm.fermK +
      providedYanPpm.dap +
      providedYanPpm.other);

  const yeastAmount = parseNumber(data.inputs.yeastAmountG || "0");
  let gfMultiplier = 0;
  let waterMultiplier = 20;

  if (data.inputs.goFermType === "none") {
    waterMultiplier = 0;
  }

  if (
    data.inputs.goFermType === "Go-Ferm" ||
    data.inputs.goFermType === "protect"
  ) {
    gfMultiplier = 1.25;
  }

  if (data.inputs.goFermType === "sterol-flash") {
    gfMultiplier = 1.2;
    waterMultiplier = waterMultiplier / 2;
  }

  const gfAmount = yeastAmount * gfMultiplier;

  return {
    targetYanPpm,
    remainingYanPpm,
    numberOfAdditions,
    nutrientAdditions: {
      totalGrams,
      perAddition
    },
    providedYanPpm,
    goFerm: {
      amount: Math.round(gfAmount * 100) / 100,
      water: Math.round(gfAmount * waterMultiplier * 100) / 100
    }
  };
}
