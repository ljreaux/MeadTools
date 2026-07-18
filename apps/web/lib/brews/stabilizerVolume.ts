export type BrewTimelineEntry = {
  id?: string;
  datetime?: string | null;
  type: string;
  data?: unknown;
};

type VolumeEntry = BrewTimelineEntry & {
  time: number;
  liters: number;
};

export function getEntryTimestamp(entry: {
  datetime?: string | null;
  createdAt?: string | null;
}) {
  const value = entry.datetime ?? entry.createdAt;
  const timestamp = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getLatestTimestamp(
  entries: Array<{ datetime?: string | null; createdAt?: string | null }>
) {
  return entries.reduce<number | null>((latest, entry) => {
    const timestamp = getEntryTimestamp(entry);
    if (timestamp == null) return latest;
    return latest == null ? timestamp : Math.max(latest, timestamp);
  }, null);
}

export function hasVolumeRecordOnOrAfter(
  entries: BrewTimelineEntry[],
  timestamp: number | null
) {
  return (
    timestamp != null &&
    entries.some(
      (entry) =>
        entry.type === "VOLUME" &&
        (getEntryTimestamp(entry) ?? -Infinity) >= timestamp
    )
  );
}

function getVolumeEntries(entries: BrewTimelineEntry[]): VolumeEntry[] {
  return entries
    .filter((entry) => entry.type === "VOLUME")
    .map((entry) => {
      const liters = (entry.data as { liters?: unknown } | null)?.liters;
      return {
        ...entry,
        time: getEntryTimestamp(entry),
        liters
      };
    })
    .filter(
      (entry): entry is VolumeEntry =>
        entry.time != null &&
        typeof entry.liters === "number" &&
        Number.isFinite(entry.liters) &&
        entry.liters > 0
    );
}

export function getMeasuredSecondaryVolumeState(args: {
  entries: BrewTimelineEntry[];
  secondaryIngredientIds: string[];
  allSecondaryIngredientsLogged: boolean;
}) {
  if (!args.allSecondaryIngredientsLogged || !args.secondaryIngredientIds.length) {
    return { hasMeasuredVolume: false, baseVolumeL: null };
  }

  const secondaryAdditions = args.entries.filter((entry) => {
    const data = entry.data as {
      kind?: unknown;
      meta?: { stage?: unknown } | null;
      recipeIngredientId?: unknown;
    } | null;
    return (
      entry.type === "ADDITION" &&
      data?.kind === "INGREDIENT" &&
      data.meta?.stage === "SECONDARY" &&
      typeof data.recipeIngredientId === "string" &&
      args.secondaryIngredientIds.includes(data.recipeIngredientId)
    );
  });
  const secondaryTimes = secondaryAdditions
    .map(getEntryTimestamp)
    .filter((time): time is number => time != null);
  if (!secondaryTimes.length) {
    return { hasMeasuredVolume: false, baseVolumeL: null };
  }

  const firstSecondaryTime = Math.min(...secondaryTimes);
  const latestSecondaryTime = Math.max(...secondaryTimes);
  const volumeEntries = getVolumeEntries(args.entries);
  const latestVolume = [...volumeEntries]
    .filter((entry) => entry.time >= latestSecondaryTime)
    .sort((a, b) => b.time - a.time)[0];
  const baseVolume = [...volumeEntries]
    .filter((entry) => entry.time < firstSecondaryTime)
    .sort((a, b) => b.time - a.time)[0];

  return {
    hasMeasuredVolume: Boolean(latestVolume && baseVolume),
    baseVolumeL: baseVolume?.liters ?? null
  };
}

export function needsSupplementalStabilizers(args: {
  currentSecondaryVolumeL: number;
  currentAdjustedVolumeL: number;
  latestSecondaryVolumeL: number | null;
  latestAdjustedVolumeL: number | null;
  thresholdL: number;
}) {
  const secondaryVolumeIncreased =
    args.latestSecondaryVolumeL != null &&
    args.currentSecondaryVolumeL >
      args.latestSecondaryVolumeL + args.thresholdL;
  const adjustedVolumeIncreased =
    args.latestAdjustedVolumeL != null &&
    args.currentAdjustedVolumeL >
      args.latestAdjustedVolumeL + args.thresholdL;

  if (
    args.latestSecondaryVolumeL != null ||
    args.latestAdjustedVolumeL != null
  ) {
    return secondaryVolumeIncreased || adjustedVolumeIncreased;
  }

  return true;
}
