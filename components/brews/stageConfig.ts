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

  // “one click add”
  addAddition: (input: {
    name: string;
    amount?: number;
    unit?: string;
    note?: string;
  }) => Promise<void>;

  // “bulk import”
  addAdditions: (
    inputs: Array<{
      name: string;
      amount?: number;
      unit?: string;
      note?: string;
    }>
  ) => Promise<void>;

  // optional dialog-driven UX hook
  openAddEntry?: (preset: { type: "ADDITION" | "GRAVITY"; data?: any }) => void;
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

export type StageConfig = {
  id: BrewStage;
  title: (t: TFunction) => string;

  // shown in Future
  prereqs?: StagePrereq[];

  // shown in Current (and optionally Past/Future depending on `when`)
  actions?: StageAction[];

  // small summary blurb for the panel
  description?: (t: TFunction) => string;

  // ✅ stage-owned component for unique UI
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
        when: (status) => status !== "future",
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
        id: "hasGravity",
        label: (t) =>
          t("brews.prereq.gravity", "Add at least one gravity reading"),
        isMet: (ctx) =>
          ctx.brew.entries.some((e) => e.type === BREW_ENTRY_TYPE.GRAVITY),
        hint: (t) =>
          t(
            "brews.prereq.gravityHint",
            "Add a gravity reading so MeadTools can track fermentation progress."
          )
      }
    ],
    actions: [
      {
        id: "addEntryGravity",
        label: (t) => t("brews.actions.addGravity", "Add gravity reading"),
        when: (status) => status === "current",
        run: async ({ openAddEntry }) => {
          openAddEntry?.({ type: "GRAVITY" });
        }
      }
    ]
    // Panel: PrimaryStagePanel (add later)
  },

  SECONDARY: {
    id: "SECONDARY",
    title: (t) => t("brewStage.SECONDARY")
    // Panel: SecondaryStagePanel
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
