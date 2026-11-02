import { InventoryError } from "./quantity";

export type VesselAssignment = {
  id: string;
  ownerId: number;
  type: "vessel" | "other";
  brewId: string | null;
};

/** A conflict needs an explicit reassignment, never silently evict a brew. */
export function planVesselAssignment(input: {
  ownerId: number;
  equipment: VesselAssignment;
  brew: { id: string; ownerId: number; complete: boolean } | null;
  reassign?: boolean;
}): VesselAssignment {
  const { equipment, brew, ownerId } = input;
  if (equipment.ownerId !== ownerId || (brew && brew.ownerId !== ownerId)) {
    throw new InventoryError("NOT_FOUND");
  }
  if (equipment.type !== "vessel") throw new InventoryError("NOT_A_VESSEL");
  if (brew?.complete) throw new InventoryError("BREW_COMPLETE");
  if (brew && equipment.brewId && equipment.brewId !== brew.id && !input.reassign) {
    throw new InventoryError("VESSEL_OCCUPIED");
  }
  return { ...equipment, brewId: brew?.id ?? null };
}

/** Completion/deletion releases occupancy only. It never returns ingredients. */
export function releaseBrewVessels(
  ownerId: number, brewId: string, equipment: readonly VesselAssignment[]
): VesselAssignment[] {
  return equipment.map((item) => item.ownerId === ownerId && item.brewId === brewId
    ? { ...item, brewId: null } : { ...item });
}
