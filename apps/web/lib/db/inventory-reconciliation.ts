import "server-only";
import { createHash } from "node:crypto";
import type { Prisma, inventory_stock } from "@prisma/client";
import {
  convertQuantity,
  lineCategories,
  tryInventoryEntryLines,
  type Quantity,
} from "@meadtools/inventory-domain";

/** Read under one transaction; the confirmation compares this full snapshot again.
 * Current physical count is authoritative. Baselines change without replaying use.
 */
export async function stockReconciliation(
  tx: Prisma.TransactionClient,
  userId: number,
  stock: inventory_stock,
) {
  const uses = await tx.inventory_consumptions.findMany({
    where: { user_id: userId, stock_id: stock.id, reversed_at: null },
    orderBy: { id: "asc" },
  });
  const entries = await tx.brew_entries.findMany({
    where: { user_id: userId, id: { in: uses.map((use) => use.entry_id) } },
    select: { id: true, brew_id: true, type: true, data: true, title: true },
  });
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const plans = uses.map((use) => {
    const entry = entryById.get(use.entry_id);
    const line =
      entry?.brew_id === use.brew_id
        ? tryInventoryEntryLines(entry.type, entry.data).find(
            (line) => line.key === use.line_key,
          )
        : undefined;
    let current: Quantity | null = null;
    const compatibleIdentity =
      !line?.catalogReference ||
      !stock.catalog ||
      (line.catalogReference.catalog === stock.catalog &&
        line.catalogReference.id === stock.catalog_id);
    if (
      line &&
      compatibleIdentity &&
      lineCategories(line).includes(stock.category)
    ) {
      try {
        current = convertQuantity(line.quantity, stock.unit);
      } catch {
        /* Never guess density or dose size. */
      }
    }
    return {
      id: use.id,
      entry_id: use.entry_id,
      brew_id: use.brew_id,
      line_key: use.line_key,
      name: line?.name ?? entry?.title ?? "",
      previous: { value: use.deducted.toNumber(), unit: use.unit },
      current,
    };
  });
  const revision = createHash("sha256")
    .update(
      JSON.stringify({
        stock: {
          id: stock.id,
          quantity: stock.quantity.toString(),
          unit: stock.unit,
          updated_at: stock.updated_at.toISOString(),
          flagged: stock.reconciliation_required,
          archived_at: stock.archived_at,
        },
        uses: uses.map((use) => ({
          id: use.id,
          entry: use.entry_id,
          brew: use.brew_id,
          key: use.line_key,
          quantity: use.deducted.toString(),
          unit: use.unit,
          updated_at: use.updated_at.toISOString(),
          entry_data: entryById.get(use.entry_id) ?? null,
        })),
      }),
    )
    .digest("hex");
  return { revision, uses: plans };
}
