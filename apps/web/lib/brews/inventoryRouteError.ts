import { NextResponse } from "next/server";
import { entryMutationError } from "./entryMutationError";
export function inventoryRouteError(error: unknown) {
  return entryMutationError(error) ?? NextResponse.json({ error: "Inventory request failed" }, { status: 500 });
}
