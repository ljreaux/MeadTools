import type { BrewEntryOutboxRecord } from "@/outbox/entry-outbox-record";

export type BrewDeleteOutboxState = {
  /** An upload is in flight; deleting now could race it. */
  sending: boolean;
  /** Entries saved on this device that have not reached the server. */
  unsentIds: string[];
};

/** What deleting a brew means for its entries still in the device outbox. */
export function brewDeleteOutboxState(
  records: readonly Pick<BrewEntryOutboxRecord, "clientEntryId" | "delivery">[]
): BrewDeleteOutboxState {
  return {
    sending: records.some((record) => record.delivery.status === "sending"),
    unsentIds: records
      .filter((record) => record.delivery.status !== "synchronized")
      .map((record) => record.clientEntryId)
  };
}
