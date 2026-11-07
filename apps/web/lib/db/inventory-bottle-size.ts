import { bottleDisplaySizeSchema } from "@meadtools/inventory-domain";
import type { Prisma } from "@prisma/client";
/** Null only for older records whose entered bottle units were not retained. */
export function storedBottleDisplaySize(row: { bottle_size_value: Prisma.Decimal | null; bottle_size_unit: string | null }) {
  return row.bottle_size_value && row.bottle_size_unit
    ? bottleDisplaySizeSchema.parse({ value: row.bottle_size_value.toNumber(), unit: row.bottle_size_unit }) : null;
}
