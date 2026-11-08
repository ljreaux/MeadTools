import {
  MeadToolsApiError,
  MeadToolsContractError
} from "@meadtools/api-client";
import {
  createBrewEntryRequestBodySchema,
  type CreateBrewEntryRequestBody
} from "@meadtools/api-contract";
import type { CreateBrewEntryPayload } from "@meadtools/brew-domain/entry-payload";

/** Version 1 stored gravity readings only; version 2 stores any supported entry. */
export const ENTRY_OUTBOX_RECORD_VERSION = 2;

/**
 * Create-only entry types that are safe to queue offline: each is a single
 * idempotent insert keyed by `client_entry_id`. Stage changes, inventory
 * deductions, bottling, edits and deletes are deliberately excluded.
 */
export const QUEUEABLE_ENTRY_TYPES = [
  "NOTE",
  "TASTING",
  "ISSUE",
  "GRAVITY",
  "TEMPERATURE",
  "PH",
  "VOLUME",
  "ADDITION"
] as const;

export type QueueableEntryType = (typeof QUEUEABLE_ENTRY_TYPES)[number];

/**
 * The account that owns a queued entry. The API origin is part of the
 * identity because the same numeric user ID can exist on local, preview and
 * production backends.
 */
export type OutboxAccount = {
  userId: number;
  apiOrigin: string;
};

export type BrewEntryRequest = CreateBrewEntryRequestBody & {
  type: QueueableEntryType;
  client_entry_id: string;
  datetime: string;
};

export type OutboxStatus =
  /** Persisted and waiting for an upload attempt. */
  | "pending"
  /** An upload attempt is in flight. */
  | "sending"
  /** A network or transient server failure; replayed automatically. */
  | "retryable_failure"
  /** The account's session is unusable; resumes after the same account signs in. */
  | "auth_required"
  /** The server rejected the entry; needs user action (retry or discard). */
  | "terminal_failure"
  /** The server confirmed the entry. */
  | "synchronized";

export type OutboxErrorKind =
  | "network"
  | "server"
  | "auth"
  | "validation"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "contract";

/**
 * Error details are limited to a category and HTTP status. Raw messages,
 * response bodies and credentials are never persisted.
 */
export type OutboxError = {
  kind: OutboxErrorKind;
  status: number | null;
};

export type OutboxDelivery = {
  status: OutboxStatus;
  attempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  synchronizedAt: string | null;
  error: OutboxError | null;
};

export type BrewEntryOutboxRecord = {
  version: typeof ENTRY_OUTBOX_RECORD_VERSION;
  account: OutboxAccount;
  brewId: string;
  clientEntryId: string;
  /** When the entry happened, as entered by the user. */
  measuredAt: string;
  /** When the entry was added to the outbox. */
  createdAt: string;
  /** Immutable request body sent on every attempt. */
  request: BrewEntryRequest;
  delivery: OutboxDelivery;
};

export type EnqueueEntryInput = {
  brewId: string;
  /**
   * A payload from the shared `entryPayload` builders. `datetime` is
   * required: it is the time the entry happened, not the upload time.
   */
  payload: CreateBrewEntryPayload & { datetime: string };
};

export class OutboxValidationError extends Error {
  readonly field: "brewId" | "type" | "datetime" | "request";

  constructor(field: OutboxValidationError["field"], message: string) {
    super(message);
    this.name = "OutboxValidationError";
    this.field = field;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const QUEUEABLE = new Set<string>(QUEUEABLE_ENTRY_TYPES);

export function sameAccount(a: OutboxAccount, b: OutboxAccount) {
  return a.userId === b.userId && a.apiOrigin === b.apiOrigin;
}

export function normalizeApiOrigin(apiBaseUrl: string) {
  return new URL(apiBaseUrl).origin;
}

/** A filesystem-safe, stable directory name for one account. */
export function outboxAccountKey(account: OutboxAccount) {
  const origin = account.apiOrigin
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `user-${account.userId}-${origin}`;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Type-specific checks beyond the API schema, so a queued entry is meaningful. */
function hasRequiredValues(request: BrewEntryRequest) {
  const data = object(request.data);
  switch (request.type) {
    case "GRAVITY":
      return finite(request.gravity) && request.gravity > 0;
    case "TEMPERATURE":
      return finite(request.temperature) && (request.temp_units === "C" || request.temp_units === "F");
    case "PH":
      return finite(data.ph) && data.ph >= 0 && data.ph <= 14;
    case "VOLUME":
      return finite(data.liters) && data.liters > 0;
    case "ADDITION":
      return typeof data.name === "string" && data.name.trim().length > 0 &&
        (data.amount === undefined || (finite(data.amount) && data.amount > 0));
    case "NOTE":
    case "TASTING":
    case "ISSUE":
      return typeof request.note === "string" && request.note.trim().length > 0;
  }
}

function isQueueableRequest(
  value: unknown,
  clientEntryId: string
): value is BrewEntryRequest {
  if (!createBrewEntryRequestBodySchema.safeParse(value).success) return false;
  const request = value as Partial<BrewEntryRequest> & Record<string, unknown>;
  return (
    typeof request.type === "string" &&
    QUEUEABLE.has(request.type) &&
    request.client_entry_id === clientEntryId &&
    typeof request.datetime === "string" &&
    !Number.isNaN(Date.parse(request.datetime)) &&
    request.inventory === undefined &&
    request.bottling === undefined &&
    request.stage_to === undefined &&
    hasRequiredValues(request as BrewEntryRequest)
  );
}

/**
 * Builds a validated, immutable outbox record from a shared payload builder.
 * The request is JSON-normalized so the persisted body is exactly the body
 * sent on every attempt.
 */
export function createOutboxRecord({
  account,
  input,
  clientEntryId,
  now
}: {
  account: OutboxAccount;
  input: EnqueueEntryInput;
  clientEntryId: string;
  now: number;
}): BrewEntryOutboxRecord {
  const brewId = input.brewId.trim();
  if (!brewId) {
    throw new OutboxValidationError("brewId", "Brew ID is required");
  }
  if (!QUEUEABLE.has(input.payload.type)) {
    throw new OutboxValidationError("type", "This entry type cannot be queued");
  }
  if (!UUID_PATTERN.test(clientEntryId)) {
    throw new OutboxValidationError("request", "Client entry ID must be a UUID");
  }
  const time = Date.parse(input.payload.datetime);
  if (Number.isNaN(time)) {
    throw new OutboxValidationError("datetime", "Entry time is invalid");
  }
  const measuredAt = new Date(time).toISOString();

  const request: unknown = JSON.parse(
    JSON.stringify({
      ...input.payload,
      datetime: measuredAt,
      client_entry_id: clientEntryId
    })
  );
  if (!isQueueableRequest(request, clientEntryId)) {
    throw new OutboxValidationError(
      "request",
      "Entry does not match the MeadTools API contract"
    );
  }

  return deepFreeze({
    version: ENTRY_OUTBOX_RECORD_VERSION,
    account: { userId: account.userId, apiOrigin: account.apiOrigin },
    brewId,
    clientEntryId,
    measuredAt,
    createdAt: new Date(now).toISOString(),
    request,
    delivery: {
      status: "pending",
      attempts: 0,
      lastAttemptAt: null,
      nextAttemptAt: null,
      synchronizedAt: null,
      error: null
    }
  });
}

export function withDelivery(
  record: BrewEntryOutboxRecord,
  delivery: Partial<OutboxDelivery>
): BrewEntryOutboxRecord {
  return deepFreeze({
    ...record,
    delivery: { ...record.delivery, ...delivery }
  });
}

const STATUSES = new Set<OutboxStatus>([
  "pending",
  "sending",
  "retryable_failure",
  "auth_required",
  "terminal_failure",
  "synchronized"
]);
const ERROR_KINDS = new Set<OutboxErrorKind>([
  "network",
  "server",
  "auth",
  "validation",
  "forbidden",
  "not_found",
  "conflict",
  "contract"
]);

function isNullableTimestamp(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" && !Number.isNaN(Date.parse(value)))
  );
}

/**
 * Parses a stored record for one account. Version 1 (gravity-only) records
 * are upgraded to version 2 in memory. Returns null for corrupt records or
 * records owned by a different account so they are never displayed or sent.
 */
export function parseOutboxRecord(
  text: string,
  account: OutboxAccount
): BrewEntryOutboxRecord | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const recordAccount = record.account as Partial<OutboxAccount> | undefined;
  const delivery = record.delivery as
    | Partial<Record<keyof OutboxDelivery, unknown>>
    | undefined;
  const error = delivery?.error as Partial<OutboxError> | null;
  const request = record.request as Partial<BrewEntryRequest> | undefined;

  if (
    (record.version !== 1 && record.version !== ENTRY_OUTBOX_RECORD_VERSION) ||
    (record.version === 1 && request?.type !== "GRAVITY") ||
    !recordAccount ||
    typeof recordAccount.userId !== "number" ||
    typeof recordAccount.apiOrigin !== "string" ||
    !sameAccount(recordAccount as OutboxAccount, account) ||
    typeof record.brewId !== "string" ||
    !record.brewId ||
    typeof record.clientEntryId !== "string" ||
    !UUID_PATTERN.test(record.clientEntryId) ||
    typeof record.measuredAt !== "string" ||
    Number.isNaN(Date.parse(record.measuredAt)) ||
    typeof record.createdAt !== "string" ||
    Number.isNaN(Date.parse(record.createdAt)) ||
    !isQueueableRequest(record.request, record.clientEntryId) ||
    request?.datetime !== record.measuredAt ||
    !delivery ||
    !STATUSES.has(delivery.status as OutboxStatus) ||
    typeof delivery.attempts !== "number" ||
    !Number.isInteger(delivery.attempts) ||
    delivery.attempts < 0 ||
    !isNullableTimestamp(delivery.lastAttemptAt) ||
    !isNullableTimestamp(delivery.nextAttemptAt) ||
    !isNullableTimestamp(delivery.synchronizedAt) ||
    (error !== null &&
      (!error ||
        !ERROR_KINDS.has(error.kind as OutboxErrorKind) ||
        !(error.status === null || typeof error.status === "number")))
  ) {
    return null;
  }

  return deepFreeze({
    ...(value as BrewEntryOutboxRecord),
    version: ENTRY_OUTBOX_RECORD_VERSION
  });
}

export function serializeOutboxRecord(record: BrewEntryOutboxRecord) {
  return JSON.stringify(record);
}

export type DeliveryErrorDisposition =
  | { disposition: "retryable"; error: OutboxError }
  | { disposition: "auth"; error: OutboxError }
  | { disposition: "terminal"; error: OutboxError };

const RETRYABLE_STATUSES = new Set([408, 425, 429]);

/**
 * Maps a delivery failure to the outbox's recovery policy. Network failures
 * and transient server responses are retried. Authentication failures pause
 * the queue. Validation, ownership/not-found and UUID conflicts need the user.
 */
export function classifyDeliveryError(error: unknown): DeliveryErrorDisposition {
  if (error instanceof MeadToolsApiError) {
    const status = error.status;

    if (status === 401) {
      return { disposition: "auth", error: { kind: "auth", status } };
    }
    if (status >= 500 || RETRYABLE_STATUSES.has(status)) {
      return { disposition: "retryable", error: { kind: "server", status } };
    }
    if (status === 403) {
      return { disposition: "terminal", error: { kind: "forbidden", status } };
    }
    if (status === 404) {
      return { disposition: "terminal", error: { kind: "not_found", status } };
    }
    if (status === 409) {
      return { disposition: "terminal", error: { kind: "conflict", status } };
    }
    return { disposition: "terminal", error: { kind: "validation", status } };
  }

  if (error instanceof MeadToolsContractError) {
    return { disposition: "terminal", error: { kind: "contract", status: null } };
  }

  // Transport failures (offline, DNS, TLS, aborted or timed-out requests)
  // surface as non-API errors. The server may or may not have committed the
  // entry, so replaying with the same client UUID is the safe recovery.
  return { disposition: "retryable", error: { kind: "network", status: null } };
}
