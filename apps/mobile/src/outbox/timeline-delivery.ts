import {
  projectBrewTimeline,
  type BrewTimelineItem,
  type BrewViewEntry
} from "@meadtools/brew-domain";

import type { BrewEntryOutboxRecord } from "./entry-outbox-record";

export type DeliveryTone = "pending" | "warning" | "error" | "success";

/** Translation key suffix under `mobileBrews.delivery.status`. */
export type DeliveryMessage =
  | "pending"
  | "sending"
  | "retryNetwork"
  | "retryServer"
  | "authRequired"
  | "rejected"
  | "notFound"
  | "conflict"
  | "forbidden"
  | "unconfirmed"
  | "synced";

export type DeliveryPresentation = {
  message: DeliveryMessage;
  tone: DeliveryTone;
  /** An upload is in flight; show progress and no actions. */
  busy: boolean;
  canRetry: boolean;
  canDiscard: boolean;
};

const TERMINAL_MESSAGES: Record<string, DeliveryMessage> = {
  validation: "rejected",
  not_found: "notFound",
  conflict: "conflict",
  forbidden: "forbidden",
  contract: "unconfirmed"
};

/**
 * Maps an outbox record to an honest, actionable delivery state. When the
 * outbox is offline (another entry just failed to reach the server), entries
 * still waiting behind it are blocked by the same connection, so they say so.
 */
export function presentDelivery(
  record: BrewEntryOutboxRecord,
  context: { offline: boolean } = { offline: false }
): DeliveryPresentation {
  const { status, error } = record.delivery;

  switch (status) {
    case "pending":
      return context.offline
        ? { message: "retryNetwork", tone: "warning", busy: false, canRetry: true, canDiscard: true }
        : { message: "pending", tone: "pending", busy: false, canRetry: false, canDiscard: true };
    case "sending":
      return { message: "sending", tone: "pending", busy: true, canRetry: false, canDiscard: false };
    case "retryable_failure":
      return {
        message: error?.kind === "server" ? "retryServer" : "retryNetwork",
        tone: "warning",
        busy: false,
        canRetry: true,
        canDiscard: true
      };
    case "auth_required":
      return { message: "authRequired", tone: "warning", busy: false, canRetry: true, canDiscard: true };
    case "terminal_failure":
      return {
        message: TERMINAL_MESSAGES[error?.kind ?? ""] ?? "rejected",
        tone: "error",
        busy: false,
        canRetry: true,
        canDiscard: true
      };
    case "synchronized":
      return { message: "synced", tone: "success", busy: false, canRetry: false, canDiscard: false };
  }
}

export type TimelineRow =
  | { kind: "server"; key: string; item: BrewTimelineItem }
  | {
      kind: "local";
      key: string;
      item: BrewTimelineItem;
      record: BrewEntryOutboxRecord;
      delivery: DeliveryPresentation;
    };

/**
 * Projects a queued request through the same shared timeline projection the
 * server rows use, so a local row reads exactly like its eventual server row.
 */
export function projectQueuedEntry(
  record: BrewEntryOutboxRecord,
  stage: BrewTimelineItem["stage"]
): BrewTimelineItem {
  const { request } = record;
  const entry: BrewViewEntry<unknown> = {
    id: record.clientEntryId,
    datetime: record.measuredAt,
    type: request.type,
    title: request.title ?? null,
    note: request.note ?? null,
    gravity: request.gravity ?? null,
    temperature: request.temperature ?? null,
    temp_units: request.temp_units ?? null,
    data: request.data ?? null
  };
  const [item] = projectBrewTimeline({ entries: [entry], entries_by_stage: [] });
  return { ...item, stage };
}

function time(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : -Infinity;
}

/**
 * Combines the server timeline with this brew's outbox records, newest first.
 * A record whose UUID is already in the server timeline is shown only once,
 * as the server row, so a confirmed entry never appears twice.
 */
export function mergeTimelineWithOutbox(
  serverItems: readonly BrewTimelineItem[],
  records: readonly BrewEntryOutboxRecord[],
  stage: BrewTimelineItem["stage"]
): TimelineRow[] {
  const serverIds = new Set(serverItems.map((item) => item.id));
  const offline = records.some(
    (record) => record.delivery.status === "retryable_failure" && record.delivery.error?.kind === "network"
  );
  const rows: TimelineRow[] = serverItems.map((item) => ({
    kind: "server",
    key: `server:${item.id}`,
    item
  }));

  for (const record of records) {
    if (serverIds.has(record.clientEntryId)) continue;
    rows.push({
      kind: "local",
      key: `local:${record.clientEntryId}`,
      item: projectQueuedEntry(record, stage),
      record,
      delivery: presentDelivery(record, { offline })
    });
  }

  // Stable for equal times: local rows (appended last) stay after server rows.
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => time(b.row.item.datetime) - time(a.row.item.datetime) || a.index - b.index)
    .map(({ row }) => row);
}
