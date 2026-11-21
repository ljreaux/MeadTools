/** The brew fields the settings form edits. */
export type BrewSettingsSource = {
  name: string | null;
  batch_number: number | null;
  start_date: string;
  requested_email_alerts: boolean;
  public: boolean;
  recipe_id: number | null;
  recipe_private: boolean | null;
};

/** What the form holds while editing; text fields stay as typed. */
export type BrewSettingsDraft = {
  name: string;
  batch: string;
  startDate: Date;
  emailAlerts: boolean;
  public: boolean;
};

export type BrewSettingsChanges = {
  name?: string | null;
  batch_number?: number | null;
  start_date?: string;
  requested_email_alerts?: boolean;
  public?: boolean;
};

export type BrewSettingsError = "batch" | "startDate";

export type BrewSettingsResult =
  | { ok: true; changes: BrewSettingsChanges }
  | { ok: false; error: BrewSettingsError };

/** A blank batch clears it; otherwise it must be a whole number of 1 or more. */
export function parseBatchNumber(input: string): number | null | undefined {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value >= 1 ? value : undefined;
}

/** A brew can be made public only when its linked recipe is public. */
export function canChangeBrewVisibility(
  brew: Pick<BrewSettingsSource, "recipe_id" | "recipe_private">
): boolean {
  return brew.recipe_id !== null && brew.recipe_private === false;
}

export function brewSettingsDraft(brew: BrewSettingsSource): BrewSettingsDraft {
  return {
    name: brew.name ?? "",
    batch: brew.batch_number === null ? "" : String(brew.batch_number),
    startDate: new Date(brew.start_date),
    emailAlerts: brew.requested_email_alerts,
    public: brew.public
  };
}

/** Only the fields that differ from the saved brew, ready for the update request. */
export function brewSettingsChanges(
  brew: BrewSettingsSource,
  draft: BrewSettingsDraft
): BrewSettingsResult {
  const batch = parseBatchNumber(draft.batch);
  if (batch === undefined) return { ok: false, error: "batch" };
  if (Number.isNaN(draft.startDate.getTime())) return { ok: false, error: "startDate" };

  const changes: BrewSettingsChanges = {};
  const name = draft.name.trim() || null;
  if (name !== (brew.name?.trim() || null)) changes.name = name;
  if (batch !== brew.batch_number) changes.batch_number = batch;
  if (draft.startDate.getTime() !== new Date(brew.start_date).getTime()) {
    changes.start_date = draft.startDate.toISOString();
  }
  if (draft.emailAlerts !== brew.requested_email_alerts) {
    changes.requested_email_alerts = draft.emailAlerts;
  }
  // Turning sharing off is always allowed; turning it on needs a public recipe.
  if (draft.public !== brew.public && (!draft.public || canChangeBrewVisibility(brew))) {
    changes.public = draft.public;
  }
  return { ok: true, changes };
}
