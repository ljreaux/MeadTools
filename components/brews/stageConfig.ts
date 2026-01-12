// stageConfig.ts
import {
  BREW_ENTRY_TYPE,
  type BrewEntryType,
  type BrewStage
} from "@/lib/brewEnums";
import type { IngredientLine } from "@/types/recipeData";
import type { TFunction } from "i18next";
import type React from "react";

// Panels (create these files/components)
// Example: components/brews/stages/PlannedStagePanel.tsx
import { PlannedStagePanel } from "./stages/PlannedStagePanel";
import { OpenAddEntryArgs } from "./AddBrewEntryDialog";
import { PrimaryStagePanel } from "./stages/PrimaryStagePanel";

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
  recipe: {
    ingredients: IngredientLine[];
  };
  brew: {
    entries: BrewEntry[];
  };
};

export type StagePrereq = {
  id: string;
  label: (t: TFunction) => string;
  isMet: (ctx: BrewStageContext) => boolean;
  hint?: (t: TFunction) => string;
};

export type BrewStageHelpers = {
  moveToStage: (to: BrewStage) => Promise<void>;

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
};

export type StageAction = {
  id: string;
  label: (t: TFunction) => string;
  when?: (status: StageStatus, ctx: BrewStageContext) => boolean;
  run: (helpers: BrewStageHelpers) => Promise<void> | void;
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

export const STAGE_FLOW: BrewStage[] = [
  "PLANNED",
  "PRIMARY",
  "SECONDARY",
  "BULK_AGE",
  "PACKAGED",
  "COMPLETE"
];

export const STAGE_CONFIG: Record<BrewStage, StageConfig> = {
  PLANNED: {
    id: "PLANNED",
    title: (t) => t("brewStage.PLANNED"),
    description: (t) =>
      t("brews.stageDesc.planned", "Get everything ready before you start."),
    prereqs: [
      {
        id: "linkRecipe",
        label: (t) =>
          t("brews.prereq.linkRecipe", "Link a recipe (recommended)"),
        isMet: (ctx) => ctx.hasRecipeLinked,
        hint: (t) =>
          t(
            "brews.prereq.linkRecipeHint",
            "Linking a recipe lets MeadTools build your ingredient checklist."
          )
      }
    ],
    actions: [
      {
        id: "moveToPrimary",
        label: (t) =>
          t("brews.actions.startPrimary", "Start primary fermentation"),
        when: (status) => status === "current",
        run: async ({ moveToStage }) => moveToStage("PRIMARY")
      }
    ],
    Panel: PlannedStagePanel
  },

  PRIMARY: {
    id: "PRIMARY",
    title: (t) => t("brewStage.PRIMARY"),
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
        isActive: (ctx) => {
          const primary = ctx.recipe.ingredients.filter((i) => !i.secondary);
          if (!primary.length) return false;

          // SUPER TEMP: treat ADDITION entries' title as ingredient name (change later)
          const addedNames = new Set(
            ctx.brew.entries
              .filter((e) => e.type === BREW_ENTRY_TYPE.ADDITION)
              .map((e) => (e.title ?? "").trim().toLowerCase())
              .filter(Boolean)
          );

          return primary.some((i) => {
            const name = (i.name ?? "").trim().toLowerCase();
            return name && !addedNames.has(name);
          });
        }
      },
      {
        id: "missingNutrients",
        message: (t) =>
          t(
            "brews.warn.nutrientsMissing",
            "Some planned nutrient additions haven’t been logged yet."
          ),
        isActive: () => false // ✅ turn on once nutrients exist
      }
    ],
    Panel: PrimaryStagePanel
  },

  SECONDARY: {
    id: "SECONDARY",
    title: (t) => t("brewStage.SECONDARY"),
    prereqs: [
      {
        id: "primaryHasGravity",
        label: (t) =>
          t("brews.prereq.gravity", "Add at least one gravity reading"),
        // ✅ this is evaluated while SECONDARY is “future”, i.e. you are still in PRIMARY
        isMet: (ctx) =>
          ctx.brew.entries.some((e) => e.type === BREW_ENTRY_TYPE.GRAVITY),
        hint: (t) =>
          t(
            "brews.prereq.gravityHint",
            "Add a gravity reading before moving out of primary."
          )
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
