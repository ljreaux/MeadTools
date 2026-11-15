import type { BrewStage } from "./projection";

/**
 * The brew tracker's stage path and move rules, shared by clients. Mirrors
 * the web tracker (`apps/web/components/brews/stageConfig.ts`): stabilized
 * and backsweetened brews are shown as bulk aging, moving backward is always
 * allowed, and moving forward requires the destination's prerequisites.
 */
export const STAGE_FLOW = [
  "PLANNED",
  "PRIMARY",
  "SECONDARY",
  "BULK_AGE",
  "PACKAGED",
  "COMPLETE"
] as const satisfies readonly BrewStage[];

export type TrackerStage = (typeof STAGE_FLOW)[number];

export function trackerStage(stage: BrewStage): TrackerStage {
  return stage === "STABILIZED" || stage === "BACKSWEETENED" ? "BULK_AGE" : stage;
}

export type StagePrerequisite =
  | "linkRecipe"
  | "originalGravity"
  | "packagingRecorded"
  | "packagedVolume";

export type StageContext = {
  hasRecipeLinked: boolean;
  hasOriginalGravity: boolean;
  hasPackagingEntry: boolean;
  /** A packaging entry with a packaged volume, or a recorded current volume. */
  hasPackagedVolume: boolean;
};

const PREREQUISITES: Partial<Record<TrackerStage, readonly StagePrerequisite[]>> = {
  PRIMARY: ["linkRecipe"],
  SECONDARY: ["originalGravity"],
  COMPLETE: ["packagingRecorded", "packagedVolume"]
};

function isMet(prerequisite: StagePrerequisite, context: StageContext) {
  switch (prerequisite) {
    case "linkRecipe":
      return context.hasRecipeLinked;
    case "originalGravity":
      return context.hasOriginalGravity;
    case "packagingRecorded":
      return context.hasPackagingEntry;
    case "packagedVolume":
      return context.hasPackagedVolume;
  }
}

export type StageMoveDecision = {
  allowed: boolean;
  isNoOp: boolean;
  direction: "forward" | "backward" | "none";
  unmet: StagePrerequisite[];
};

/**
 * Whether the brew can move from `current` to `to`. A forward move that
 * crosses into secondary or later from before secondary uses secondary's
 * prerequisites (a recorded OG), exactly like the web tracker.
 */
export function stageMoveDecision(
  to: TrackerStage,
  current: BrewStage,
  context: StageContext
): StageMoveDecision {
  const from = trackerStage(current);
  const toIndex = STAGE_FLOW.indexOf(to);
  const fromIndex = STAGE_FLOW.indexOf(from);
  const secondaryIndex = STAGE_FLOW.indexOf("SECONDARY");

  if (to === from) return { allowed: false, isNoOp: true, direction: "none", unmet: [] };
  if (toIndex < fromIndex) return { allowed: true, isNoOp: false, direction: "backward", unmet: [] };

  const prerequisites =
    fromIndex < secondaryIndex && toIndex >= secondaryIndex
      ? PREREQUISITES.SECONDARY ?? []
      : PREREQUISITES[to] ?? [];
  const unmet = prerequisites.filter((prerequisite) => !isMet(prerequisite, context));
  return { allowed: unmet.length === 0, isNoOp: false, direction: "forward", unmet };
}
