import type { BrewTimelineItem } from "@meadtools/brew-domain";

import type { GravityOutboxRecord } from "./gravity-outbox-record";

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

/** Maps an outbox record to an honest, actionable delivery state. */
export function presentDelivery(record: GravityOutboxRecord): DeliveryPresentation {
  const { status, error } = record.delivery;

  switch (status) {
    case "pending":
      return { message: "pending", tone: "pending", busy: false, canRetry: false, canDiscard: true };
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
      record: GravityOutboxRecord;
      delivery: DeliveryPresentation;
    };

function localItem(
  record: GravityOutboxRecord,
  stage: BrewTimelineItem["stage"]
): BrewTimelineItem {
  const role = record.request.data?.readingRole;
  return {
    id: record.clientEntryId,
    datetime: record.measuredAt,
    type: "GRAVITY",
    title: record.request.title ?? null,
    note: record.request.note ?? null,
    stage,
    detail: {
      kind: "gravity",
      value: record.request.gravity,
      role: role === "OG" || role === "FG" ? role : "GENERAL"
    }
  };
}

function time(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : -Infinity;
}

/**
 * Combines the server timeline with this brew's outbox records, newest first.
 * A record whose UUID is already in the server timeline is shown only once,
 * as the server row, so a confirmed reading never appears twice.
 */
export function mergeTimelineWithOutbox(
  serverItems: readonly BrewTimelineItem[],
  records: readonly GravityOutboxRecord[],
  stage: BrewTimelineItem["stage"]
): TimelineRow[] {
  const serverIds = new Set(serverItems.map((item) => item.id));
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
      item: localItem(record, stage),
      record,
      delivery: presentDelivery(record)
    });
  }

  // Stable for equal times: local rows (appended last) stay after server rows.
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => time(b.row.item.datetime) - time(a.row.item.datetime) || a.index - b.index)
    .map(({ row }) => row);
}
