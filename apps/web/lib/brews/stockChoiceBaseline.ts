import type { BrewInventoryContextResponse } from "@meadtools/api-contract/contracts";
export type StockChoiceBaseline = {
  entryId: string;
  uses: BrewInventoryContextResponse["usages"];
  tracked: boolean;
};
/** Capture only when an edit starts or its own save succeeds. Unrelated query
 * refreshes must not replace an unsaved edit's optimistic concurrency snapshot. */
export function captureStockChoiceBaseline(
  entryId: string,
  context: Pick<BrewInventoryContextResponse, "usages" | "tracked_entry_ids">,
): StockChoiceBaseline {
  return {
    entryId,
    uses: context.usages.filter((use) => use.entry_id === entryId),
    tracked: context.tracked_entry_ids.includes(entryId),
  };
}

/** The first write may have committed even when its response was lost. Keep
 * its client identity until a successful save, so retries cannot create a new use. */
export function packagingEntryIdentity(
  pending: { current: string | null },
  existingId?: string,
  createId: () => string = () => crypto.randomUUID(),
): string {
  return existingId ?? (pending.current ??= createId());
}
