import { BrewEntryIdConflictError } from "@/lib/brews/createBrewEntryIdempotently";

/**
 * Offline clients queue a stage change with a client UUID and the stage they
 * expected the brew to be in. A replay after a lost response must not move
 * the brew again, and a stale change must not overwrite a newer one made
 * elsewhere (for example on the web while the phone was offline).
 */
export class BrewStageConflictError extends Error {
  readonly currentStage: string;

  constructor(currentStage: string) {
    super("Brew stage changed");
    this.name = "BrewStageConflictError";
    this.currentStage = currentStage;
  }
}

export type PriorStageChangeEntry = {
  brew_id: string;
  user_id: number | null;
  type: string;
};

/**
 * Decides what to do with a queued stage change, given any existing entry
 * with the client UUID and the brew's current (row-locked) stage.
 *
 * - `"replay"`: this exact change was already applied; return the brew as is.
 * - `"apply"`: apply the change and store its entry under the client UUID.
 *
 * Throws `BrewEntryIdConflictError` when the UUID belongs to another entry,
 * brew or owner, and `BrewStageConflictError` when the brew is no longer in
 * the expected stage.
 */
export function decideQueuedStageChange({
  prior,
  brewId,
  userId,
  currentStage,
  expectedStage
}: {
  prior: PriorStageChangeEntry | null;
  brewId: string;
  userId: number;
  currentStage: string;
  expectedStage?: string;
}): "replay" | "apply" {
  if (prior) {
    if (prior.brew_id === brewId && prior.user_id === userId && prior.type === "STAGE_CHANGE") {
      return "replay";
    }
    throw new BrewEntryIdConflictError();
  }
  if (expectedStage !== undefined && currentStage !== expectedStage) {
    throw new BrewStageConflictError(currentStage);
  }
  return "apply";
}
