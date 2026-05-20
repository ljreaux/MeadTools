// stageConfig.ts
import {
  BREW_ENTRY_TYPE,
  type BrewEntryType,
  type BrewStage
} from "@/lib/brewEnums";
import type { TFunction } from "i18next";
import type React from "react";

// Panels (create these files/components)
// Example: components/brews/stages/PlannedStagePanel.tsx
import { PlannedStagePanel } from "./stages/PlannedStagePanel";
import { OpenAddEntryArgs } from "./AddBrewEntryDialog";
import { PrimaryStagePanel } from "./stages/PrimaryStagePanel";
import { SecondaryStagePanel } from "./stages/SecondaryStagePanel";
import {
  CreateBrewEntryInput,
  PatchAccountBrewMetadataInput
} from "@/hooks/reactQuery/useAccountBrews";
import type { BrewRecipeStageData } from "@/lib/utils/buildBrewRecipeStageData";
import { parseNumber } from "@/lib/utils/validateInput";

export type StageStatus = "past" | "current" | "future";
export type BrewEntry = {
  id: string;
  type: BrewEntryType;
  title: string | null;
  note: string | null;
  data: any; // tighten later
  createdAt?: string; // optional
};
export type BrewStageContext = {
  // what stage the brew is currently in (NOT the active tab)
  brewStage: BrewStage;

  // page-level facts the stage panels/prereqs/actions can use
  hasRecipeLinked: boolean;

  // recipe snapshot/provider data that panels can render
  recipe: BrewRecipeStageData["planned"] & {
    derived: BrewRecipeStageData["derived"];
    snapshot: BrewRecipeStageData["snapshot"];
    recipeData: BrewRecipeStageData["recipeData"];
    actual: BrewRecipeStageData["actual"];
    effective: BrewRecipeStageData["effective"];
  };
  brew: {
    id: string;
    entries: BrewEntry[];
    current_volume_liters: number | null;
    effective_current_volume_liters: number | null;
    latest_gravity: number | null;
    effective_latest_gravity: number | null;
  };
};

export type StagePrereq = {
  id: string;
  label: (t: TFunction) => string;
  isMet: (ctx: BrewStageContext) => boolean;
  hint?: (t: TFunction) => string;
  actionLabel?: (t: TFunction) => string;
  run?: (helpers: BrewStageHelpers, ctx: BrewStageContext) => Promise<void> | void;
};

export type BrewStageHelpers = {
  moveToStage: (to: BrewStage, datetime?: string) => Promise<void>;
  openRecordVolume?: () => void;
  acceptRecipeOriginalGravity?: () => Promise<void>;

  addAddition: (input: {
    name: string;
    amount?: number;
    unit?: string;
    note?: string;
    recipeIngredientId?: string;
    recipeAdditiveId?: string;
    kind?: "INGREDIENT" | "NUTRIENT" | "YEAST" | "OTHER";
    source?:
      | "recipe_ingredient"
      | "recipe_additive"
      | "recipe_nutrient"
      | "recipe_go_ferm"
      | "recipe_yeast"
      | "manual_yeast"
      | "manual";
    meta?: Record<string, any>;
    datetime?: string;
  }) => Promise<void>;

  addAdditions: (
    inputs: Array<{
      name: string;
      amount?: number;
      unit?: string;
      note?: string;
      recipeIngredientId?: string;
      recipeAdditiveId?: string;
      kind?: "INGREDIENT" | "NUTRIENT" | "YEAST" | "OTHER";
      source?:
        | "recipe_ingredient"
        | "recipe_additive"
        | "recipe_nutrient"
        | "recipe_go_ferm"
        | "recipe_yeast"
        | "manual_yeast"
        | "manual";
      meta?: Record<string, any>;
      datetime?: string;
    }>
  ) => Promise<void>;

  openAddEntry?: (args?: OpenAddEntryArgs) => void;
  openStageMoveReview?: (to: BrewStage) => void;
  openOriginalGravityDialog?: () => void;
  openFinalGravityDialog?: () => void;
  addEntry: (input: CreateBrewEntryInput) => Promise<void>;
  patchBrewMetadata: (input: PatchAccountBrewMetadataInput) => Promise<void>;
  openLinkRecipePage?: () => void;
};

export type StageAction = {
  id: string;
  label: (t: TFunction) => string;
  when?: (status: StageStatus, ctx: BrewStageContext) => boolean;
  run: (helpers: BrewStageHelpers, ctx: BrewStageContext) => Promise<void> | void;
  variant?: "default" | "secondary" | "destructive";
};

export type StagePanelProps = {
  t: TFunction;
  status: StageStatus;
  ctx: BrewStageContext;
  helpers: BrewStageHelpers;
  warnings?: StageWarning[];
};

export type StageWarning = {
  id: string;
  message: (t: TFunction) => string;
  isActive: (ctx: BrewStageContext) => boolean; // true => show warning
  when: (status: StageStatus, ctx: BrewStageContext) => boolean;
};

export type StageConfig = {
  id: BrewStage;
  title: (t: TFunction) => string;

  // shown in Future
  prereqs?: StagePrereq[];

  // shown in Current (and optionally Past/Future depending on `when`)
  actions?: StageAction[];

  // small summary blurb for the panel
  description?: (t: TFunction) => string;

  warnings?: StageWarning[];
  Panel?: React.ComponentType<StagePanelProps>;
};

export type StageMoveDecision = {
  allowed: boolean;
  isNoOp: boolean;
  unmet: StagePrereq[];
  direction: "backward" | "forward" | "none";
};

function getPlannedPrimaryIngredientIds(ctx: BrewStageContext) {
  return new Set(
    (ctx.recipe.primaryIngredients ?? [])
      .filter((l) => (l.name ?? "").trim().length > 0)
      .map((l) => String(l.lineId))
  );
}

function getPlannedSecondaryIngredientIds(ctx: BrewStageContext) {
  return new Set(
    (ctx.recipe.secondaryIngredients ?? [])
      .filter((l) => (l.name ?? "").trim().length > 0)
      .map((l) => String(l.lineId))
  );
}

function getPlannedAdditiveIds(ctx: BrewStageContext) {
  return new Set(
    (ctx.recipe.additives ?? [])
      .filter((l) => (l.name ?? "").trim().length > 0)
      .map((l) => String(l.lineId))
  );
}

function getLoggedRecipeIngredientIds(ctx: BrewStageContext) {
  return new Set(ctx.recipe.actual.loggedRecipeIngredientIds ?? []);
}

function getLoggedRecipeAdditiveIds(ctx: BrewStageContext) {
  return new Set(ctx.recipe.actual.loggedRecipeAdditiveIds ?? []);
}

function hasMissingPrimaryIngredients(ctx: BrewStageContext) {
  if (!ctx.hasRecipeLinked) return false;

  const planned = getPlannedPrimaryIngredientIds(ctx);
  if (planned.size === 0) return false;

  const logged = getLoggedRecipeIngredientIds(ctx);

  for (const id of planned) {
    if (!logged.has(id)) return true;
  }
  return false;
}

function hasMissingSecondaryIngredients(ctx: BrewStageContext) {
  if (!ctx.hasRecipeLinked) return false;

  const planned = getPlannedSecondaryIngredientIds(ctx);
  if (planned.size === 0) return false;

  const logged = getLoggedRecipeIngredientIds(ctx);

  for (const id of planned) {
    if (!logged.has(id)) return true;
  }
  return false;
}

function hasMissingAdditives(ctx: BrewStageContext) {
  if (!ctx.hasRecipeLinked) return false;

  const planned = getPlannedAdditiveIds(ctx);
  if (planned.size === 0) return false;

  const logged = getLoggedRecipeAdditiveIds(ctx);

  for (const id of planned) {
    if (!logged.has(id)) return true;
  }
  return false;
}

function hasOriginalGravity(ctx: BrewStageContext) {
  return Boolean(ctx.recipe.actual.originalGravity);
}

function hasFinalGravity(ctx: BrewStageContext) {
  return Boolean(ctx.recipe.actual.finalGravity);
}

function hasYeastAddition(ctx: BrewStageContext) {
  return Boolean(ctx.recipe.actual.yeastAddition);
}

function getPlannedNutrientAdditionCount(ctx: BrewStageContext) {
  const count = ctx.recipe.nutrientPlan?.derived.numberOfAdditions;
  return typeof count === "number" && Number.isFinite(count) && count > 0
    ? Math.floor(count)
    : 0;
}

function hasMissingPlannedNutrients(ctx: BrewStageContext) {
  const planned = getPlannedNutrientAdditionCount(ctx);
  if (planned === 0) return false;

  const remaining = ctx.recipe.actual.remainingNutrientGrams;
  return Object.values(remaining ?? {}).some(
    (amount) => typeof amount === "number" && Number.isFinite(amount) && amount > 0.01
  );
}

function getEstimatedFinalGravity(ctx: BrewStageContext) {
  const fg = parseNumber(ctx.recipe.recipeData?.fg ?? "");
  return Number.isFinite(fg) && fg > 0 ? fg : null;
}

function hasFinalGravityOutsideEstimate(ctx: BrewStageContext) {
  const finalGravity = ctx.recipe.actual.finalGravity?.gravity;
  const estimated = getEstimatedFinalGravity(ctx);

  if (
    typeof finalGravity !== "number" ||
    !Number.isFinite(finalGravity) ||
    estimated == null
  ) {
    return false;
  }

  return Math.abs(finalGravity - estimated) > 0.005;
}

function hasCurrentVolume(ctx: BrewStageContext) {
  const v = ctx.brew.current_volume_liters;
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

export const STAGE_FLOW: BrewStage[] = [
  "PLANNED",
  "PRIMARY",
  "SECONDARY",
  "BULK_AGE",
  "PACKAGED",
  "COMPLETE"
];

export function getStageMoveDecision(
  toStage: BrewStage,
  currentStage: BrewStage,
  ctx: BrewStageContext
): StageMoveDecision {
  const toIdx = STAGE_FLOW.indexOf(toStage);
  const currentIdx = STAGE_FLOW.indexOf(currentStage);
  const secondaryIdx = STAGE_FLOW.indexOf("SECONDARY");
  const prereqs =
    currentIdx < secondaryIdx && toIdx >= secondaryIdx
      ? (STAGE_CONFIG.SECONDARY?.prereqs ?? [])
      : (STAGE_CONFIG[toStage]?.prereqs ?? []);
  const unmet = prereqs.filter((p) => !p.isMet(ctx));

  if (toStage === currentStage) {
    return {
      allowed: false,
      isNoOp: true,
      unmet: [],
      direction: "none"
    };
  }

  if (toIdx < currentIdx) {
    return {
      allowed: true,
      isNoOp: false,
      unmet: [],
      direction: "backward"
    };
  }

  return {
    allowed: unmet.length === 0,
    isNoOp: false,
    unmet,
    direction: "forward"
  };
}

export const STAGE_CONFIG: Record<BrewStage, StageConfig> = {
  PLANNED: {
    id: "PLANNED",
    title: (t) => t("brewStage.PLANNED"),
    description: (t) =>
      t("brews.stageDesc.planned", "Get everything ready before you start."),
    actions: [
      {
        id: "moveToPrimary",
        label: (t) =>
          t("brews.actions.startPrimary", "Start primary fermentation"),
        when: (status, ctx) => status === "current" && ctx.hasRecipeLinked,
        run: async ({ moveToStage }) => moveToStage("PRIMARY")
      }
    ],
    Panel: PlannedStagePanel
  },

  PRIMARY: {
    id: "PRIMARY",
    title: (t) => t("brewStage.PRIMARY"),
    prereqs: [
      {
        id: "linkRecipe",
        label: (t) => t("brews.prereq.linkRecipe", "Link a recipe"),
        isMet: (ctx) => ctx.hasRecipeLinked,
        hint: (t) =>
          t(
            "brews.prereq.linkRecipeHardHint",
            "Brew tracking needs a linked recipe before primary can start."
          ),
        actionLabel: (t) =>
          t("brews.planned.linkRecipeAction", "Link recipe"),
        run: ({ openLinkRecipePage }) => {
          openLinkRecipePage?.();
        }
      }
    ],
    actions: [
      // “Add entry” for primary (multi-type)
      {
        id: "addEntryPrimary",
        label: (t) => t("brews.actions.addEntry", "Add entry"),
        when: (status) => status === "current",
        run: async ({ openAddEntry }) => {
          openAddEntry?.({
            allowedTypes: [
              BREW_ENTRY_TYPE.GRAVITY,
              BREW_ENTRY_TYPE.TEMPERATURE,
              BREW_ENTRY_TYPE.PH,
              BREW_ENTRY_TYPE.NOTE,
              BREW_ENTRY_TYPE.TASTING,
              BREW_ENTRY_TYPE.ISSUE
            ]
          });
        }
      }
    ],
    warnings: [
      {
        id: "missingPrimaryIngredients",
        message: (t) =>
          t(
            "brews.warn.primaryIngredientsMissing",
            "Not all primary ingredients have been added to this brew yet."
          ),
        isActive: (ctx) => hasMissingPrimaryIngredients(ctx),
        when: (status) => status === "current"
      },
      {
        id: "missingOriginalGravity",
        message: (t) =>
          t(
            "brews.warn.originalGravityMissing",
            "Original gravity has not been logged yet."
          ),
        isActive: (ctx) => !hasOriginalGravity(ctx),
        when: (status) => status === "current"
      },
      {
        id: "missingFinalGravity",
        message: (t) =>
          t(
            "brews.warn.finalGravityMissing",
            "Final gravity has not been logged yet."
          ),
        isActive: (ctx) => !hasFinalGravity(ctx),
        when: (status) => status === "current"
      },
      {
        id: "missingYeast",
        message: (t) =>
          t("brews.warn.yeastMissing", "Yeast has not been logged yet."),
        isActive: (ctx) => !hasYeastAddition(ctx),
        when: (status) => status === "current"
      },
      {
        id: "missingNutrients",
        message: (t) =>
          t(
            "brews.warn.nutrientsMissing",
            "Some planned nutrient additions haven’t been logged yet."
          ),
        isActive: (ctx) => hasMissingPlannedNutrients(ctx),
        when: (status) => status === "current"
      },
      {
        id: "finalGravityEstimateMismatch",
        message: (t) =>
          t(
            "brews.warn.finalGravityEstimateMismatch",
            "Final gravity is not close to the recipe’s estimated FG."
          ),
        isActive: (ctx) => hasFinalGravityOutsideEstimate(ctx),
        when: (status) => status === "current"
      }
    ],
    Panel: PrimaryStagePanel
  },

  SECONDARY: {
    id: "SECONDARY",
    title: (t) => t("brewStage.SECONDARY"),
    actions: [
      {
        id: "addEntrySecondary",
        label: (t) => t("brews.actions.addEntry", "Add entry"),
        when: (status) => status === "current",
        run: async ({ openAddEntry }) => {
          openAddEntry?.({
            allowedTypes: [
              BREW_ENTRY_TYPE.GRAVITY,
              BREW_ENTRY_TYPE.TEMPERATURE,
              BREW_ENTRY_TYPE.PH,
              BREW_ENTRY_TYPE.NOTE,
              BREW_ENTRY_TYPE.TASTING,
              BREW_ENTRY_TYPE.ISSUE
            ]
          });
        }
      }
    ],
    warnings: [
      {
        id: "missingPrimaryIngredients",
        message: (t) =>
          t(
            "brews.warn.primaryIngredientsMissing",
            "Not all primary ingredients have been added to this brew yet."
        ),
        isActive: (ctx) => hasMissingPrimaryIngredients(ctx),
        when: (status) => status === "current"
      },
      {
        id: "missingSecondaryIngredients",
        message: (t) =>
          t(
            "brews.warn.secondaryIngredientsMissing",
            "Some planned secondary additions haven’t been logged yet."
          ),
        isActive: (ctx) => hasMissingSecondaryIngredients(ctx),
        when: (status) => status === "current"
      },
      {
        id: "missingAdditives",
        message: (t) =>
          t(
            "brews.warn.additivesMissing",
            "Some linked recipe additives haven’t been logged yet."
          ),
        isActive: (ctx) => hasMissingAdditives(ctx),
        when: (status) => status === "current"
      },
      {
        id: "missingCurrentVolume",
        message: (t) =>
          t(
            "brews.warn.currentVolumeMissing",
            "Current volume has not been recorded yet."
          ),
        isActive: (ctx) => !hasCurrentVolume(ctx),
        when: (status) => status === "current"
      }
    ],
    prereqs: [
      {
        id: "primaryHasGravity",
        label: (t) =>
          t("brews.prereq.originalGravity", "Log original gravity"),
        isMet: (ctx) => hasOriginalGravity(ctx),
        hint: (t) =>
          t(
            "brews.prereq.originalGravityHint",
            "Log a measured OG or accept the recipe OG before moving out of primary."
          ),
        actionLabel: (t) => t("brews.actions.logOg", "Log OG"),
        run: ({ openOriginalGravityDialog, openAddEntry }) => {
          if (openOriginalGravityDialog) {
            openOriginalGravityDialog();
            return;
          }
          openAddEntry?.({
            presetType: BREW_ENTRY_TYPE.GRAVITY,
            gravityRole: "OG"
          });
        }
      },
      {
        id: "primaryHasFinalGravity",
        label: (t) => t("brews.prereq.finalGravity", "Log final gravity"),
        isMet: (ctx) => hasFinalGravity(ctx),
        hint: (t) =>
          t(
            "brews.prereq.finalGravityHint",
            "Log a measured FG before moving out of primary."
          ),
        actionLabel: (t) => t("brews.actions.logFg", "Log FG"),
        run: ({ openFinalGravityDialog, openAddEntry }) => {
          if (openFinalGravityDialog) {
            openFinalGravityDialog();
            return;
          }
          openAddEntry?.({
            presetType: BREW_ENTRY_TYPE.GRAVITY,
            gravityRole: "FG"
          });
        }
      },
      {
        id: "primaryHasVolume",
        label: (t) => t("brews.prereq.volume", "Record secondary volume"),
        isMet: (ctx) => {
          const v = ctx.brew.current_volume_liters;
          return typeof v === "number" && Number.isFinite(v) && v > 0;
        },
        hint: (t) =>
          t(
            "brews.prereq.volumeHint",
            "Record the total volume after transferring to secondary so stabilizers and later additions can use the right batch size."
          ),
        actionLabel: (t) =>
          t("brews.actions.logVolume", "Record volume"),
        run: ({ openRecordVolume }) => {
          openRecordVolume?.();
        }
      },
      {
        id: "primaryHasYeast",
        label: (t) => t("brews.prereq.yeast", "Log yeast"),
        isMet: (ctx) => hasYeastAddition(ctx),
        hint: (t) =>
          t(
            "brews.prereq.yeastHint",
            "Log at least one yeast addition before moving out of primary."
          ),
        actionLabel: (t) => t("brews.actions.logYeast", "Log yeast")
      }
    ],
    Panel: SecondaryStagePanel
  },

  BULK_AGE: {
    id: "BULK_AGE",
    title: (t) => t("brewStage.BULK_AGE")
    // Panel: BulkAgeStagePanel
  },

  PACKAGED: {
    id: "PACKAGED",
    title: (t) => t("brewStage.PACKAGED")
    // Panel: PackagedStagePanel
  },

  COMPLETE: {
    id: "COMPLETE",
    title: (t) => t("brewStage.COMPLETE")
    // Panel: CompleteStagePanel
  }
};
