export type YeastBrand =
  | "Lalvin"
  | "Fermentis"
  | "Mangrove Jack"
  | "Red Star"
  | "Other";

export type NitrogenRequirement =
  | "Very Low"
  | "Low"
  | "Medium"
  | "High"
  | "Very High";
export type VolumeUnits = "gal" | "liter";
export type ScheduleType =
  | "tbe"
  | "tosna"
  | "justK"
  | "dap"
  | "oAndk"
  | "oAndDap"
  | "kAndDap"
  | "other";

// Yeast data model (for each yeast)
export type Yeast = {
  id: number;
  brand: YeastBrand;
  name: string;
  nitrogen_requirement: NitrogenRequirement;
  tolerance: string;
  low_temp: string;
  high_temp: string;
};

export type FullNutrientData = {
  inputs: {
    volume: string;
    sg: string;
    offset: string;
    numberOfAdditions: string;
  };
  selected: {
    yeastBrand: YeastBrand;
    yeastStrain: string;
    yeastDetails: Yeast;
    n2Requirement: NitrogenRequirement;
    volumeUnits: VolumeUnits;
    schedule: ScheduleType;
    selectedNutrients: string[];
  };
  yanContribution: number[];
  outputs: {
    targetYan: number;
    yeastAmount: number;
    goFerm?: { type: GoFermType; amount: number; water: number };
  };
  otherNutrientName?: string;
};

export type NutrientType = {
  inputs: {
    volume: {
      value: string;
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    };
    sg: {
      value: string;
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    };
    offset: {
      value: string;
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    };
    numberOfAdditions: {
      value: string;
      onValueChange: (value: string) => void;
    };
    volumeUnits: {
      value: VolumeUnits;
      onChange: (val: VolumeUnits) => void;
    };
  };
  selected: {
    yeastBrand: YeastBrand;
    yeastStrain: string;
    yeastDetails: Yeast;
    n2Requirement: NitrogenRequirement;
    volumeUnits: VolumeUnits;
    schedule: ScheduleType;
    selectedNutrients: string[];
    yeastNitrogenRequirement: NitrogenRequirement;
  };
  setVolume: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setSG: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setOffset: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setNumberOfAdditions: (e: string) => void;
  setYeastBrand: (brand: YeastBrand) => void;
  setYeastName: (name: string) => void;
  setSelectedNutrients: (nutrients: string[]) => void;
  yeastList: Yeast[];
  loadingYeasts: boolean;
  maxGpl: string[];
  targetYAN: number;
  yeastAmount: string;
  changeYeastAmount: (e: React.ChangeEvent<HTMLInputElement>) => void;
  goFermType: {
    value: GoFermType;
    onChange: (val: GoFermType) => void;
  };
  goFerm: {
    amount: number;
    water: number;
  };
  nutrientAdditions: {
    totalGrams: number[];
    perAddition: number[];
  };
  setNitrogenRequirement: (value: NitrogenRequirement) => void;
  otherYanContribution: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
  otherNutrientName: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
  yanContributions: string[];
  editYanContribution: (index: number, value: string) => void;
  editMaxGpl: (index: number, value: string) => void;
  remainingYan: number;
  providedYan: string[];
  updateProvidedYan: (index: number, value: string) => void;
  adjustAllowed: boolean;
  setAdjustAllowed: (value: boolean) => void;
  fullData: FullNutrientData;
};
export type MaxGplEntry = {
  name: string;
  value: string[] | string[][];
};

export type GoFermType = "Go-Ferm" | "protect" | "sterol-flash" | "none";

// constants

export const maxGpl: Record<ScheduleType, MaxGplEntry> = {
  tbe: { name: "TBE (All Three)", value: ["0.45", "0.5", "0.96", "0"] },
  tosna: { name: "TOSNA (Fermaid O Only)", value: ["2.5", "0", "0", "0"] },
  justK: { name: "Fermaid K Only", value: ["0", "3", "0", "0"] },
  dap: { name: "DAP Only", value: ["0", "0", " 1.5", "0"] },
  oAndk: {
    name: "Fermaid O & K",
    value: [
      ["0.6", "0.81", " 0", " 0"],
      ["0.9", "0.81", " 0", " 0"],
      ["1.1", "1", " 0", " 0"],
    ],
  },
  oAndDap: { name: "Fermaid O & DAP", value: ["1", " 0", "0.96", " 0"] },
  kAndDap: { name: "Fermaid K & DAP", value: ["0", "1", "0.96", " 0"] },
  other: { name: "Other", value: ["0", "0", "0", "0"] },
};

export const initialFullData = {
  inputs: {
    volume: "1",
    sg: "1",
    offset: "0",
    numberOfAdditions: "1",
  },
  selected: {
    yeastBrand: "Lalvin",
    yeastStrain: "18-2007",
    yeastDetails: {
      id: 1,
      brand: "Lalvin",
      name: "18-2007",
      nitrogen_requirement: "Low",
      tolerance: "17",
      low_temp: "55",
      high_temp: "95",
    },
    n2Requirement: "Low",
    volumeUnits: "gal",
    schedule: "tosna",
    selectedNutrients: ["Fermaid O"],
  },
  yanContribution: [40, 100, 210],
  outputs: {
    targetYan: 351,
    yeastAmount: 3.07,
  },
} as FullNutrientData;
