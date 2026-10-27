import { z } from "zod";
import { bottleSizeLitersSchema } from "./finished-mead";
import { InventoryError } from "./quantity";

export const productionBottleRowSchema = z.object({
  id: z.string().uuid(),
  label: z.string().max(200),
  quantity: z.number().int().positive().max(1_000_000_000),
  sizeLiters: bottleSizeLitersSchema,
});
export const bottlingOutputSchema = z
  .object({
    row_id: z.string().uuid(),
    quantity: z.number().int().positive().max(1_000_000_000),
    target: z.discriminatedUnion("kind", [
      z
        .object({ kind: z.literal("existing"), mead_id: z.string().uuid() })
        .strict(),
      z
        .object({
          kind: z.literal("new"),
          mead_id: z.string().uuid(),
          name: z.string().trim().min(1).max(200),
        })
        .strict(),
    ]),
    location_id: z.string().uuid().nullable().default(null),
    position: z.string().trim().max(200).default(""),
  })
  .strict();
export const bottlingSelectionSchema = z
  .object({
    operation_id: z.string().uuid(),
    expected_revision: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    mode: z.enum(["sync", "reconcile"]),
    confirmed_on_hand: z.boolean().default(false),
    outputs: z.array(bottlingOutputSchema).max(100),
  })
  .strict();
export type BottlingSelection = z.infer<typeof bottlingSelectionSchema>;
export type ProductionBottleRow = z.infer<typeof productionBottleRowSchema>;
export function productionBottleRows(data: unknown): ProductionBottleRow[] {
  const rows = z
    .object({ bottleRows: z.array(productionBottleRowSchema).max(100) })
    .parse(data).bottleRows;
  if (new Set(rows.map((row) => row.id)).size !== rows.length)
    throw new InventoryError("LINK_MISMATCH");
  return rows;
}
/** Counts come from confirmed bottle rows, never from measured/estimated yield. */
export function validateBottlingOutputs(
  rows: ProductionBottleRow[],
  outputs: BottlingSelection["outputs"],
) {
  for (const output of outputs)
    if (!rows.some((row) => row.id === output.row_id))
      throw new InventoryError("LINK_MISMATCH");
  for (const row of rows) {
    const assigned = outputs
      .filter((output) => output.row_id === row.id)
      .reduce((sum, output) => sum + output.quantity, 0);
    if (!Number.isSafeInteger(assigned) || assigned > row.quantity)
      throw new InventoryError("INVALID_QUANTITY");
  }
}
/** Preserve subsequent receipts and uses while applying the production difference. */
export function productionDifference(
  balance: number,
  previous: number,
  next: number,
) {
  const value = balance + next - previous;
  if (
    ![balance, previous, next, value].every(Number.isSafeInteger) ||
    value < 0 ||
    value > 1_000_000_000
  )
    throw new InventoryError(
      value < 0 ? "INSUFFICIENT_STOCK" : "INVALID_QUANTITY",
    );
  return {
    balance: { value, unit: "units" as const },
    adjustment: next - previous,
  };
}
