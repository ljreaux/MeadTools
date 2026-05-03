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
import { PatchAccountBrewMetadataInput } from "@/hooks/reactQuery/useAccountBrews";
import type { BrewRecipeStageData } from "@/lib/utils/buildBrewRecipeStageData";

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
  moveToStage: (to: BrewStage) => Promise<void>;
  openRecordVolume?: () => void;

  addAddition: (input: {
    name: string;
    amount?: number;
    unit?: string;
    note?: string;
    recipeIngredientId?: string;
  }) => Promise<void>;

  addAdditions: (
    inputs: Array<{
      name: string;
      amount?: number;
      unit?: string;
      note?: string;
      recipeIngredientId?: string;
    }>
  ) => Promise<void>;

  openAddEntry?: (args?: OpenAddEntryArgs) => void;
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

function getLoggedRecipeIngredientIds(ctx: BrewStageContext) {
  return new Set(ctx.recipe.actual.loggedRecipeIngredientIds ?? []);
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
  const prereqs = STAGE_CONFIG[toStage]?.prereqs ?? [];
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
        id: "missingNutrients",
        message: (t) =>
          t(
            "brews.warn.nutrientsMissing",
            "Some planned nutrient additions haven’t been logged yet."
          ),
        isActive: () => false, // ✅ turn on once nutrients exist
        when: (status) => status === "current"
      }
    ],
    Panel: PrimaryStagePanel
  },

  SECONDARY: {
    id: "SECONDARY",
    title: (t) => t("brewStage.SECONDARY"),
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
      }
    ],
    prereqs: [
      {
        id: "primaryHasGravity",
        label: (t) =>
          t("brews.prereq.gravity", "Add at least one gravity reading"),
        isMet: (ctx) =>
          ctx.brew.entries.some((e) => e.type === BREW_ENTRY_TYPE.GRAVITY),
        hint: (t) =>
          t(
            "brews.prereq.gravityHint",
            "Add a gravity reading before moving out of primary."
          ),
        actionLabel: (t) => t("brews.actions.addEntry", "Add entry"),
        run: ({ openAddEntry }) => {
          openAddEntry?.({ presetType: BREW_ENTRY_TYPE.GRAVITY });
        }
      },
      {
        id: "primaryHasVolume",
        label: (t) => t("brews.prereq.volume", "Record current volume"),
        isMet: (ctx) => {
          const v = ctx.brew.current_volume_liters;
          return typeof v === "number" && Number.isFinite(v) && v > 0;
        },
        hint: (t) =>
          t(
            "brews.prereq.volumeHint",
            "When the brew volume changes, record the actual amount here."
          ),
        actionLabel: (t) =>
          t("brews.actions.logVolume", "Log volume"),
        run: ({ openRecordVolume }) => {
          openRecordVolume?.();
        }
      }
    ]
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
