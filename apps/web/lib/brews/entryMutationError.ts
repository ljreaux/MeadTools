import { EquipmentAssignmentChangedError } from "@/lib/db/equipment";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { InventoryError } from "@meadtools/inventory-domain";
import { InventoryWriteError } from "@/lib/db/inventory";

/** Allowlisted errors only; never expose arbitrary exception/SQL messages. */
export function entryMutationError(error: unknown): NextResponse | null {
  if (error instanceof EquipmentAssignmentChangedError) return NextResponse.json({error:"Container assignments changed; review them again",code:error.code},{status:409});
  if (error instanceof ZodError) return NextResponse.json({
    error: "Invalid inventory request", code: "INVALID_INVENTORY_REQUEST",
  }, { status: 400 });
  if (error instanceof InventoryError || error instanceof InventoryWriteError) {
    const code = error.code;
    const status = code === "NOT_FOUND" ? 404 : code === "PREMIUM_REQUIRED" ? 403 :
      ["INCOMPATIBLE_UNITS", "QUANTITY_PRECISION", "INVALID_QUANTITY", "ENTRY_MISMATCH", "LINK_MISMATCH"].includes(code) ? 400 : 409;
    return NextResponse.json({
      error: code === "INSUFFICIENT_STOCK" ? "Insufficient stock" :
        code === "SELECTION_REQUIRED" ? "Review the inventory deduction before changing this use" :
        code === "PREMIUM_REQUIRED" ? "Premium access is required for inventory deductions" : "Inventory operation could not be completed",
      code,
      ...(error instanceof InventoryError && code === "INSUFFICIENT_STOCK" ? {
        shortage: error.details?.shortage, unit: error.details?.unit,
      } : {}),
    }, { status });
  }
  if (error instanceof Error && ["Brew not found", "Entry not found"].includes(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof Error && ["Cannot delete stage change entry", "No valid fields to update", "Invalid datetime", "Missing stage_to"].includes(error.message)) {
    return NextResponse.json({ error: "Invalid entry request" }, { status: 400 });
  }
  return null;
}
