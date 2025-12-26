// prisma/migrateLegacyData.ts (or wherever you keep it)

import type { RecipeApiResponse } from "@/hooks/reactQuery/useRecipeQuery";
import type {
  NoteLine,
  RecipeData,
  VolumeUnit,
  WeightUnit
} from "@/types/recipeData";
import type { NutrientData } from "@/types/nutrientData";
import { getEffectiveMaxGpl } from "@/types/nutrientData";
import prisma from "../prisma";
import { Prisma } from "@prisma/client";
import { concatNotes } from "../db/recipes";

// --------------------
// small helpers
// --------------------

// replace with whatever you use today
const genId = () => Math.random().toString(36).slice(2, 12);

function safeJsonParse<T>(input: unknown, fallback: T): T {
  if (typeof input !== "string") return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

const normalizeWeightUnit = (u: string): WeightUnit =>
  u === "lbs" ? "lb" : (u as WeightUnit);

const normalizeVolumeUnit = (u: unknown): VolumeUnit => {
  const s = String(u ?? "")
    .trim()
    .toLowerCase();

  if (s === "liter") return "L";
  if (s === "gal") return "gal";

  return "gal"; // safe default
};

function selectedNutrientsFromLegacy(arr: unknown) {
  const list = Array.isArray(arr) ? arr : [];
  const set = new Set(list.filter((x): x is string => typeof x === "string"));
  return {
    fermO: set.has("Fermaid O"),
    fermK: set.has("Fermaid K"),
    dap: set.has("DAP"),
    other: set.has("Other")
  };
}

function legacyMaxGplFromNuteInfo(input: unknown): null | {
  fermO: string;
  fermK: string;
  dap: string;
  other: string;
} {
  if (typeof input !== "string") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  // Allow 3 or 4 values
  if (parsed.length < 3 || parsed.length > 4) return null;

  const asStrings = parsed.map((v) => {
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return v;
    return "";
  });

  // Must all be numeric-ish
  const ok = asStrings.every((s) => {
    const n = Number(s);
    return s !== "" && Number.isFinite(n);
  });

  if (!ok) return null;

  const [fermO, fermK, dap, other = "0"] = asStrings;
  return { fermO, fermK, dap, other };
}

// --------------------
// core converter (kept compatible with your existing usage)
// --------------------
export function migrateLegacyRecipeToV2(recipe: RecipeApiResponse): RecipeData {
  const legacy = safeJsonParse<any>(recipe.recipeData, {});
  const legacyNutes = safeJsonParse<any>(recipe.nutrientData, {});

  const yan = safeJsonParse<string[]>(
    recipe.yanContribution ?? '["40","100","210","0"]',
    ["40", "100", "210", "0"]
  );
  const [fermO, fermK, dap, other = "0"] = yan;

  const unitDefaults: RecipeData["unitDefaults"] = {
    weight: normalizeWeightUnit(legacy.units?.weight ?? "lb"),
    volume: normalizeVolumeUnit(legacy.units?.volume ?? "gal")
  };

  const ingredients: RecipeData["ingredients"] = (legacy.ingredients ?? []).map(
    (ing: any) => {
      const weight = String(ing.details?.[0] ?? "");
      const volume = String(ing.details?.[1] ?? "");
      const basis = ing.category === "water" ? "volume" : "weight";

      return {
        lineId: genId(),
        name: String(ing.name ?? ""),
        ref: { kind: "custom" as const },
        category: String(ing.category ?? "other"),
        brix: String(ing.brix ?? "0.00"),
        secondary: !!ing.secondary,
        amounts: {
          weight: { value: weight, unit: unitDefaults.weight },
          volume: { value: volume, unit: unitDefaults.volume },
          basis
        }
      };
    }
  );

  const additives: RecipeData["additives"] = (legacy.additives ?? []).map(
    (a: any) => ({
      lineId: genId(),
      name: String(a.name ?? ""),
      amount: String(a.amount ?? "0"),
      unit: (a.unit ?? "g") as any, // if you have a strict unit union, swap this cast to the real type
      amountTouched: false,
      amountDim: "weight" as const
    })
  );

  const nutrientsSelected = selectedNutrientsFromLegacy(
    legacyNutes?.selected?.selectedNutrients
  );

  const deltaSg = String(legacyNutes?.inputs?.sg ?? "1.000");

  const legacyGoFermType = legacyNutes?.outputs?.goFerm?.type;
  // Examples from your file include: "Go-Ferm", "protect", "sterol-flash", "none".  [oai_citation:0‡recipes_rows (4).json](sediment://file_00000000391871f590082d72e1457da4)

  const yeastAmount = legacyNutes?.outputs?.yeastAmount;
  const hasYeastAmount =
    yeastAmount !== undefined &&
    yeastAmount !== null &&
    String(yeastAmount) !== "";

  const nutrientData: NutrientData = {
    version: 2,
    inputs: {
      volume: String(legacyNutes?.inputs?.volume ?? legacy.volume ?? "1.000"),
      volumeUnits: legacyNutes?.inputs?.units === "gal" ? "gal" : "liter",
      sg: deltaSg,
      offsetPpm: String(legacyNutes?.inputs?.offset ?? "0"),
      numberOfAdditions: String(legacyNutes?.inputs?.numberOfAdditions ?? "1"),

      // ✅ pull from legacy if present, otherwise fall back
      goFermType: (legacyGoFermType ?? "Go-Ferm") as any,

      // ✅ preserve yeast amount and mark as touched when legacy actually had it
      yeastAmountG: hasYeastAmount ? String(yeastAmount) : "0",
      yeastAmountTouched: hasYeastAmount
    },
    selected: {
      yeastBrand: String(legacyNutes?.selected?.yeastBrand ?? "Other"),
      yeastStrain: String(legacyNutes?.selected?.yeastStrain ?? "Unknown"),
      yeastId: legacyNutes?.selected?.yeastDetails?.id,
      nitrogenRequirement: (legacyNutes?.selected?.n2Requirement ??
        "Low") as NutrientData["selected"]["nitrogenRequirement"],
      schedule: (legacyNutes?.selected?.schedule ??
        "tbe") as NutrientData["selected"]["schedule"],
      selectedNutrients: nutrientsSelected
    },
    settings: {
      yanContribution: { fermO, fermK, dap, other },
      maxGpl: getEffectiveMaxGpl({
        schedule: (legacyNutes?.selected?.schedule ??
          "tbe") as NutrientData["selected"]["schedule"],
        sg: deltaSg,
        selected: nutrientsSelected
      }),
      maxGplTouched: false,
      other: { name: "" }
    },
    adjustments: {
      adjustAllowed: false,
      providedYanPpm: { fermO: "0", fermK: "0", dap: "0", other: "0" }
    }
  };

  const notesToV2 = (pairs: unknown): NoteLine[] => {
    const list = Array.isArray(pairs) ? pairs : [];
    return list.map((pair) => ({
      lineId: genId(),
      content: Array.isArray(pair)
        ? (pair as NoteLine["content"])
        : (["", ""] as NoteLine["content"])
    }));
  };
  // OPTIONAL legacy override: some recipes stored per-nutrient maxGpl in nuteInfo as a stringified array
  const legacyOverride = legacyMaxGplFromNuteInfo((recipe as any).nuteInfo);

  if (legacyOverride) {
    nutrientData.settings.maxGpl = legacyOverride;
    nutrientData.settings.maxGplTouched = true; // prevents “helpful” recompute from overwriting
  }

  const legacyStabilizers = legacy?.stabilizers ?? {};
  const legacyStabilizerType = legacy?.stabilizerType;

  const stabilizers: RecipeData["stabilizers"] = {
    adding: !!legacyStabilizers.adding,
    takingPh: !!legacyStabilizers.pH, // legacy uses "pH"
    phReading: String(legacyStabilizers.phReading ?? ""),
    type: (legacyStabilizerType ?? "kmeta") as any
  };

  return {
    version: 2,
    unitDefaults,
    ingredients,
    fg: String(legacy.FG ?? "1.000"),
    additives,
    stabilizers,
    notes: {
      primary: notesToV2(recipe.primaryNotes),
      secondary: notesToV2(recipe.secondaryNotes)
    },
    nutrients: nutrientData,
    flags: { private: !!recipe.private }
  };
}

// --------------------
// migrateLegacyData runner (exported for other files)
// --------------------

// Minimal shape you need to build a RecipeApiResponse-like object for migration.
// (RecipeApiResponse likely includes more fields, but we only need these.)
type RecipeForMigration = {
  id: number;
  name: string;
  recipeData: string;
  nutrientData: string;
  yanContribution?: string;
  primaryNotes: string[][];
  secondaryNotes: string[][];
  private: boolean;

  // ✅ add this
  nuteInfo: string | null;
};

function rowToRecipeApiLike(row: {
  id: number;
  name: string;
  recipeData: string;
  nutrientData: string;
  yanContribution: string | null;
  primaryNotes: string[];
  secondaryNotes: string[];
  private: boolean;

  // ✅ add this
  nuteInfo: string | null;
}): RecipeForMigration {
  return {
    id: row.id,
    name: row.name,
    recipeData: row.recipeData,
    nutrientData: row.nutrientData,
    yanContribution: row.yanContribution ?? undefined,
    primaryNotes: concatNotes(row.primaryNotes),
    secondaryNotes: concatNotes(row.secondaryNotes),
    private: row.private,

    // ✅ pass it through
    nuteInfo: row.nuteInfo
  };
}

/**
 * Migrates all legacy rows (where dataV2 is DbNull/JsonNull) into dataV2.
 * Does NOT delete anything.
 */
export async function migrateLegacyData(opts?: {
  limit?: number;
  dryRun?: boolean;
  log?: (msg: string) => void;
}) {
  const log = opts?.log ?? console.log;
  const limit = opts?.limit;

  const where: Prisma.recipesWhereInput = {
    AND: [
      { version: 1 }, // strongly recommended so you don’t accidentally re-migrate
      {
        OR: [
          // <-- this is the missing one in most setups
          { dataV2: { equals: Prisma.DbNull } },
          { dataV2: { equals: Prisma.JsonNull } }
        ]
      }
    ]
  };

  const rows = await prisma.recipes.findMany({
    where,
    take: limit,
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      recipeData: true,
      nutrientData: true,
      yanContribution: true,
      primaryNotes: true,
      secondaryNotes: true,
      private: true,
      nuteInfo: true
    }
  });

  log(`Found ${rows.length} legacy recipe(s) to migrate.`);

  let migrated = 0;
  for (const row of rows) {
    const apiLike = rowToRecipeApiLike(row);
    const v2 = migrateLegacyRecipeToV2(apiLike as unknown as RecipeApiResponse);

    if (opts?.dryRun) {
      log(`[dryRun] would migrate recipe ${row.id} (${row.name})`);
      migrated++;
      continue;
    }

    await prisma.recipes.update({
      where: { id: row.id },
      data: {
        dataV2: v2 as unknown as Prisma.InputJsonValue,
        version: 2
      }
    });

    migrated++;
    log(`Migrated recipe ${row.id} (${row.name})`);
  }

  return { found: rows.length, migrated };
}

// If you still want the old "test call" behavior in this file,
// keep it behind an env flag so importing doesn't auto-run.
if (process.env.RUN_RECIPE_MIGRATION === "true") {
  migrateLegacyData().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
