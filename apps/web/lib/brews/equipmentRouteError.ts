import { NextResponse } from "next/server";
import { EquipmentAssignmentChangedError } from "@/lib/db/equipment";
import { entryMutationError } from "./entryMutationError";

export function equipmentRouteError(error: unknown) {
  if (error instanceof EquipmentAssignmentChangedError) return NextResponse.json({
    error: "The vessel assignment changed; refresh and try again", code: error.code,
  }, { status: 409 });
  return entryMutationError(error) ?? NextResponse.json({ error: "Equipment request failed" }, { status: 500 });
}
