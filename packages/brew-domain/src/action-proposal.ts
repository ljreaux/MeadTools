import type { CreateBrewEntryPayload } from "./entry-payload";

export const brewActionStages = [
  "PLANNED",
  "PRIMARY",
  "SECONDARY",
  "BULK_AGE",
  "STABILIZED",
  "BACKSWEETENED",
  "PACKAGED",
  "COMPLETE"
] as const;

export type BrewActionStage = (typeof brewActionStages)[number];

/**
 * The assistant never chooses this target. A trusted client obtains it from
 * the explicitly selected, ownership-scoped brew context and supplies it when
 * the proposal is created.
 */
export type BrewActionTarget = {
  brewId: string;
  brewLabel: string;
};

export type BrewActionEntryPayload =
  | CreateBrewEntryPayload
  | {
      type: "STAGE_CHANGE";
      datetime?: string;
      title?: string | null;
      note?: string | null;
      stage_to: BrewActionStage;
    };

/**
 * A reviewable intent to mutate one selected brew. This is deliberately not a
 * command: a client must render the payload and explicitly confirm it through
 * its normal ownership-checked brew-entry API.
 */
export type BrewActionProposal = {
  version: 1;
  kind: "create_brew_entry";
  target: BrewActionTarget;
  summary: string;
  entry: BrewActionEntryPayload;
};

export function createBrewActionProposal(
  target: BrewActionTarget,
  entry: BrewActionEntryPayload
): BrewActionProposal {
  return {
    version: 1,
    kind: "create_brew_entry",
    target,
    summary: describeBrewActionEntry(entry),
    entry
  };
}

export function describeBrewActionEntry(entry: BrewActionEntryPayload): string {
  if (entry.type === "STAGE_CHANGE") {
    return `Move this brew to ${formatStage(entry.stage_to)}.`;
  }
  if (entry.type === "ADDITION") {
    const amount = entry.data.amount;
    const unit = entry.data.unit;
    const quantity =
      typeof amount === "number"
        ? `${formatNumber(amount)}${unit ? ` ${unit}` : ""} `
        : "";
    return `Log ${quantity}${entry.data.name} as an addition.`;
  }
  if (entry.type === "GRAVITY") {
    return `Log a gravity reading of ${entry.gravity.toFixed(3)}.`;
  }
  if (entry.type === "TEMPERATURE") {
    return `Log a temperature reading of ${formatNumber(entry.temperature)} °${entry.temp_units}.`;
  }
  if (entry.type === "PH") {
    return `Log a pH reading of ${formatNumber(entry.data.ph)}.`;
  }
  if (entry.type === "VOLUME") {
    const display =
      entry.data.displayValue !== undefined && entry.data.displayUnit
        ? `${formatNumber(entry.data.displayValue)} ${entry.data.displayUnit}`
        : `${formatNumber(entry.data.liters)} L`;
    return `Log a volume of ${display}.`;
  }
  if (entry.type === "PACKAGING") {
    return `Log ${formatNumber(entry.data.packagedVolumeLiters)} L as packaged.`;
  }
  return entry.title?.trim() || "Log a brew note.";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatStage(stage: BrewActionStage): string {
  return stage.toLowerCase().replace(/_/g, " ");
}
