import type { RecipeData } from "@/types/recipeData";
import type { RecipeDerivedApiResponse } from "@/lib/utils/calculateRecipeDerivedApiResponse";

/**
 * Golden fixture provenance
 *
 * The recipe inputs below are hand-authored representative scenarios. Their
 * matching `*DerivedGolden` objects were captured on 2026-07-02 by passing
 * those inputs through the original, pre-extraction implementation of
 * `calculateRecipeDerivedApiResponse`.
 *
 * At capture time, recipe/nutrient/stabilizer calculations still lived in
 * `lib/utils`; only gravity and temperature primitives had moved to
 * `@meadtools/core`. No recipe-derived calculation was changed to produce
 * these values.
 *
 * These expected values are intentionally literal—not recalculated inside the
 * tests—so moving or rewriting calculation code causes a visible test failure.
 * Do not regenerate them merely to make a failing test pass. First determine
 * whether the result change is intentional, document the product/contract
 * decision, and review the old and new outputs before updating the goldens.
 */

export const traditionalRecipeFixture: RecipeData = {
  version: 2,
  unitDefaults: {
    weight: "lb",
    volume: "gal"
  },
  ingredients: [
    {
      lineId: "traditional-water",
      name: "Water",
      ref: { kind: "custom" },
      category: "water",
      brix: "0",
      secondary: false,
      amounts: {
        weight: { value: "6.25", unit: "lb" },
        volume: { value: "0.75", unit: "gal" },
        basis: "volume"
      }
    },
    {
      lineId: "traditional-honey",
      name: "Wildflower Honey",
      ref: { kind: "custom" },
      category: "sugar",
      brix: "79.6",
      secondary: false,
      amounts: {
        weight: { value: "3", unit: "lb" },
        volume: { value: "0.25", unit: "gal" },
        basis: "weight"
      }
    }
  ],
  fg: "1.000",
  additives: [],
  stabilizers: {
    adding: false,
    takingPh: false,
    phReading: "3.6",
    type: "kmeta"
  },
  notes: {
    primary: [],
    secondary: []
  },
  nutrients: {
    version: 2,
    inputs: {
      volume: "1",
      volumeUnits: "gal",
      sg: "1",
      offsetPpm: "0",
      numberOfAdditions: "4",
      goFermType: "Go-Ferm",
      yeastAmountG: "",
      yeastAmountTouched: false
    },
    selected: {
      yeastBrand: "Lalvin",
      yeastStrain: "D-47",
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
      other: { name: "" }
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
  }
};

export const backsweetenedMetricRecipeFixture: RecipeData = {
  version: 2,
  unitDefaults: {
    weight: "kg",
    volume: "L"
  },
  ingredients: [
    {
      lineId: "metric-water",
      name: "Water",
      ref: { kind: "custom" },
      category: "water",
      brix: "0",
      secondary: false,
      amounts: {
        weight: { value: "3", unit: "kg" },
        volume: { value: "3", unit: "L" },
        basis: "volume"
      }
    },
    {
      lineId: "metric-honey",
      name: "Orange Blossom Honey",
      ref: { kind: "custom" },
      category: "sugar",
      brix: "79.6",
      secondary: false,
      amounts: {
        weight: { value: "1.4", unit: "kg" },
        volume: { value: "1", unit: "L" },
        basis: "weight"
      }
    },
    {
      lineId: "metric-cherry",
      name: "Cherry Juice",
      ref: { kind: "custom" },
      category: "juice",
      brix: "15",
      secondary: true,
      amounts: {
        weight: { value: "0.8", unit: "kg" },
        volume: { value: "750", unit: "mL" },
        basis: "volume"
      }
    }
  ],
  fg: "1.010",
  additives: [],
  stabilizers: {
    adding: true,
    takingPh: true,
    phReading: "3.44",
    type: "kmeta"
  },
  notes: {
    primary: [],
    secondary: []
  },
  nutrients: {
    version: 2,
    inputs: {
      volume: "4",
      volumeUnits: "liter",
      sg: "1.1",
      offsetPpm: "12",
      numberOfAdditions: "3",
      goFermType: "sterol-flash",
      yeastAmountG: "7.5",
      yeastAmountTouched: true
    },
    selected: {
      yeastBrand: "Lalvin",
      yeastStrain: "71B",
      nitrogenRequirement: "High",
      schedule: "oAndk",
      selectedNutrients: {
        fermO: true,
        fermK: true,
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
        fermO: "0.9",
        fermK: "0.81",
        dap: "0",
        other: "0"
      },
      maxGplTouched: false,
      other: { name: "" }
    },
    adjustments: {
      adjustAllowed: true,
      providedYanPpm: {
        fermO: "144",
        fermK: "81",
        dap: "0",
        other: "0"
      }
    }
  }
};

export const emptyRecipeFixture: RecipeData = {
  version: 2,
  unitDefaults: {
    weight: "kg",
    volume: "L"
  },
  ingredients: [],
  fg: "",
  additives: [],
  stabilizers: {
    adding: true,
    takingPh: true,
    phReading: "2.85",
    type: "nameta"
  },
  notes: {
    primary: [],
    secondary: []
  }
};

export const traditionalDerivedGolden = {
  gravity: {
    ogPrimary: 1.103742104261216,
    backsweetenedFg: 1,
    totalForAbv: 1.103742104261216
  },
  volume: {
    unit: "gal",
    primary: 1.0000000001584255,
    secondary: 0,
    total: 1.0000000001584255,
    primaryL: 3.785411784,
    secondaryL: 0,
    totalL: 3.785411784
  },
  alcohol: {
    abv: 13.77420412007451,
    delle: 61.9819185403354
  },
  stabilizers: {
    sorbate: 0,
    sulfite: 0,
    campden: 0
  },
  nutrients: {
    targetYanPpm: 204,
    remainingYanPpm: 0,
    numberOfAdditions: 4,
    nutrientAdditions: {
      totalGrams: {
        fermO: 4.825875,
        fermK: 0,
        dap: 0,
        other: 0
      },
      perAddition: {
        fermO: 1.20646875,
        fermK: 0,
        dap: 0,
        other: 0
      }
    },
    providedYanPpm: {
      fermO: 204,
      fermK: 0,
      dap: 0,
      other: 0
    },
    goFerm: {
      amount: 3.75,
      water: 75
    }
  }
} satisfies RecipeDerivedApiResponse["derived"];

export const backsweetenedMetricDerivedGolden = {
  gravity: {
    ogPrimary: 1.103742104261216,
    backsweetenedFg: 1.0180813170657894,
    totalForAbv: 1.0970220364436558
  },
  volume: {
    unit: "L",
    primary: 4,
    secondary: 0.75,
    total: 4.75,
    primaryL: 4,
    secondaryL: 0.75,
    totalL: 4.75
  },
  alcohol: {
    abv: 10.493586135756875,
    delle: 51.81819873114241
  },
  stabilizers: {
    sorbate: 0.8718488618384947,
    sulfite: 0.26666666666666666,
    campden: 0.5353889450988576
  },
  nutrients: {
    targetYanPpm: 295,
    remainingYanPpm: 70,
    numberOfAdditions: 3,
    nutrientAdditions: {
      totalGrams: {
        fermO: 3.6,
        fermK: 3.24,
        dap: 0,
        other: 0
      },
      perAddition: {
        fermO: 1.2,
        fermK: 1.08,
        dap: 0,
        other: 0
      }
    },
    providedYanPpm: {
      fermO: 144,
      fermK: 81,
      dap: 0,
      other: 0
    },
    goFerm: {
      amount: 9,
      water: 90
    }
  }
} satisfies RecipeDerivedApiResponse["derived"];

export const emptyDerivedGolden = {
  gravity: {
    ogPrimary: 1,
    backsweetenedFg: 0,
    totalForAbv: 1
  },
  volume: {
    unit: "L",
    primary: 0,
    secondary: 0,
    total: 0,
    primaryL: 0,
    secondaryL: 0,
    totalL: 0
  },
  alcohol: {
    abv: 0,
    delle: -668.962
  },
  stabilizers: {
    sorbate: 0,
    sulfite: 0,
    campden: 0
  },
  nutrients: {
    targetYanPpm: -0,
    remainingYanPpm: -0,
    numberOfAdditions: 1,
    nutrientAdditions: {
      totalGrams: {
        fermO: 0,
        fermK: 0,
        dap: 0,
        other: 0
      },
      perAddition: {
        fermO: 0,
        fermK: 0,
        dap: 0,
        other: 0
      }
    },
    providedYanPpm: {
      fermO: 0,
      fermK: 0,
      dap: 0,
      other: 0
    },
    goFerm: {
      amount: 0,
      water: 0
    }
  }
} satisfies RecipeDerivedApiResponse["derived"];
