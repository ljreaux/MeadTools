import Fuse from "fuse.js";

export type HydrometerChoice = {
  id: string;
  name: string;
  description?: string;
  disabled?: boolean;
};

/** The rename endpoint interprets a blank name as an end-session request. */
export function hydrometerBrewName(value: string): string | null {
  return value.trim() || null;
}

export function searchHydrometerChoices<T extends HydrometerChoice>(
  choices: readonly T[],
  search: string
): T[] {
  const query = search.trim();
  return query
    ? new Fuse([...choices], { keys: ["name", "description"], threshold: 0.4 })
        .search(query)
        .map((item) => item.item)
    : [...choices];
}

export function linkableHydrometerDevices<T extends { brew_id: string | null }>(
  devices: readonly T[],
  brewId: string
): T[] {
  return devices.filter((device) => device.brew_id === null || device.brew_id === brewId);
}

/** Attaching and importing are separate server operations. Never hide a completed attachment. */
export async function linkHydrometerWithUnassignedLogs(operations: {
  attach(): Promise<unknown>;
  importLogs(): Promise<{ adopted_count: number }>;
}): Promise<{ linked: true; imported: boolean; adoptedCount: number | null }> {
  await operations.attach();
  try {
    const result = await operations.importLogs();
    return { linked: true, imported: true, adoptedCount: result.adopted_count };
  } catch {
    return { linked: true, imported: false, adoptedCount: null };
  }
}
