import {
  MeadToolsApiError,
  MeadToolsContractError
} from "@meadtools/api-client";
import {
  createBrewEntryRequestBodySchema,
  type CreateBrewEntryRequestBody
} from "@meadtools/api-contract";
import {
  entryPayload,
  type GravityEntryDisplayData
} from "@meadtools/brew-domain/entry-payload";

export const GRAVITY_OUTBOX_RECORD_VERSION = 1;

/**
 * The account that owns a queued reading. The API origin is part of the
 * identity because the same numeric user ID can exist on local, preview and
 * production backends.
 */
export type OutboxAccount = {
  userId: number;
  apiOrigin: string;
};

export type GravityEntryRequest = CreateBrewEntryRequestBody & {
  type: "GRAVITY";
  client_entry_id: string;
  datetime: string;
  gravity: number;
};

export type GravityOutboxStatus =
  /** Persisted and waiting for an upload attempt. */
  | "pending"
  /** An upload attempt is in flight. */
  | "sending"
  /** A network or transient server failure; replayed automatically. */
  | "retryable_failure"
  /** The account's session is unusable; resumes after the same account signs in. */
  | "auth_required"
  /** The server rejected the reading; needs user action (retry or discard). */
  | "terminal_failure"
  /** The server confirmed the entry. */
  | "synchronized";

export type GravityOutboxErrorKind =
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
export type GravityOutboxError = {
  kind: GravityOutboxErrorKind;
  status: number | null;
};

export type GravityOutboxDelivery = {
  status: GravityOutboxStatus;
  attempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  synchronizedAt: string | null;
  error: GravityOutboxError | null;
};

export type GravityOutboxRecord = {
  version: typeof GRAVITY_OUTBOX_RECORD_VERSION;
  account: OutboxAccount;
  brewId: string;
  clientEntryId: string;
  /** When the reading was taken, as entered by the user. */
  measuredAt: string;
  /** When the reading was added to the outbox. */
  createdAt: string;
  /** Immutable request body sent on every attempt. */
  request: GravityEntryRequest;
  delivery: GravityOutboxDelivery;
};

export type EnqueueGravityInput = {
  brewId: string;
  /** Specific gravity sent to the server. */
  gravity: number;
  measuredAt: Date | string;
  note?: string | null;
  /** Entered value/unit metadata preserved for timeline display. */
  display?: GravityEntryDisplayData;
};

export class GravityOutboxValidationError extends Error {
  readonly field: "brewId" | "gravity" | "measuredAt" | "request";

  constructor(field: GravityOutboxValidationError["field"], message: string) {
    super(message);
    this.name = "GravityOutboxValidationError";
    this.field = field;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function toIsoTimestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();

  if (Number.isNaN(time)) {
    throw new GravityOutboxValidationError(
      "measuredAt",
      "Measurement time is invalid"
    );
  }

  return date.toISOString();
}

function isGravityRequest(
  value: unknown,
  clientEntryId: string
): value is GravityEntryRequest {
  if (!createBrewEntryRequestBodySchema.safeParse(value).success) {
    return false;
  }

  const request = value as Partial<GravityEntryRequest>;
  return (
    request.type === "GRAVITY" &&
    request.client_entry_id === clientEntryId &&
    typeof request.gravity === "number" &&
    Number.isFinite(request.gravity) &&
    typeof request.datetime === "string" &&
    !Number.isNaN(Date.parse(request.datetime))
  );
}

/**
 * Builds a validated, immutable outbox record with the shared gravity payload
 * builder. The request is JSON-normalized so the persisted body is exactly
 * the body sent on every attempt.
 */
export function createGravityOutboxRecord({
  account,
  input,
  clientEntryId,
  now
}: {
  account: OutboxAccount;
  input: EnqueueGravityInput;
  clientEntryId: string;
  now: number;
}): GravityOutboxRecord {
  const brewId = input.brewId.trim();
  if (!brewId) {
    throw new GravityOutboxValidationError("brewId", "Brew ID is required");
  }
  if (!Number.isFinite(input.gravity) || input.gravity <= 0) {
    throw new GravityOutboxValidationError(
      "gravity",
      "Gravity must be a positive number"
    );
  }
  if (!UUID_PATTERN.test(clientEntryId)) {
    throw new GravityOutboxValidationError(
      "request",
      "Client entry ID must be a UUID"
    );
  }

  const measuredAt = toIsoTimestamp(input.measuredAt);
  const note = input.note?.trim() || null;
  const payload = entryPayload.gravity(input.gravity, note, {
    readingRole: "GENERAL",
    source: "measured",
    datetime: measuredAt,
    display: input.display
  });
  const request: unknown = JSON.parse(
    JSON.stringify({ ...payload, client_entry_id: clientEntryId })
  );

  if (!isGravityRequest(request, clientEntryId)) {
    throw new GravityOutboxValidationError(
      "request",
      "Gravity entry does not match the MeadTools API contract"
    );
  }

  return deepFreeze({
    version: GRAVITY_OUTBOX_RECORD_VERSION,
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
  record: GravityOutboxRecord,
  delivery: Partial<GravityOutboxDelivery>
): GravityOutboxRecord {
  return deepFreeze({
    ...record,
    delivery: { ...record.delivery, ...delivery }
  });
}

const STATUSES = new Set<GravityOutboxStatus>([
  "pending",
  "sending",
  "retryable_failure",
  "auth_required",
  "terminal_failure",
  "synchronized"
]);
const ERROR_KINDS = new Set<GravityOutboxErrorKind>([
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
 * Parses a stored record for one account. Returns null for corrupt records or
 * records owned by a different account so they are never displayed or sent.
 */
export function parseGravityOutboxRecord(
  text: string,
  account: OutboxAccount
): GravityOutboxRecord | null {
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
    | Partial<Record<keyof GravityOutboxDelivery, unknown>>
    | undefined;
  const error = delivery?.error as Partial<GravityOutboxError> | null;

  if (
    record.version !== GRAVITY_OUTBOX_RECORD_VERSION ||
    !recordAccount ||
    typeof recordAccount.userId !== "number" ||
    typeof recordAccount.apiOrigin !== "string" ||
    !sameAccount(recordAccount as OutboxAccount, account) ||
    typeof record.brewId !== "string" ||
    !record.brewId ||
    typeof record.clientEntryId !== "string" ||
    !UUID_PATTERN.test(record.clientEntryId) ||
    !isNullableTimestamp(record.measuredAt) ||
    record.measuredAt === null ||
    !isNullableTimestamp(record.createdAt) ||
    record.createdAt === null ||
    !isGravityRequest(record.request, record.clientEntryId) ||
    (record.request as GravityEntryRequest).datetime !== record.measuredAt ||
    !delivery ||
    !STATUSES.has(delivery.status as GravityOutboxStatus) ||
    typeof delivery.attempts !== "number" ||
    !Number.isInteger(delivery.attempts) ||
    delivery.attempts < 0 ||
    !isNullableTimestamp(delivery.lastAttemptAt) ||
    !isNullableTimestamp(delivery.nextAttemptAt) ||
    !isNullableTimestamp(delivery.synchronizedAt) ||
    (error !== null &&
      (!error ||
        !ERROR_KINDS.has(error.kind as GravityOutboxErrorKind) ||
        !(error.status === null || typeof error.status === "number")))
  ) {
    return null;
  }

  return deepFreeze(value as GravityOutboxRecord);
}

export function serializeGravityOutboxRecord(record: GravityOutboxRecord) {
  return JSON.stringify(record);
}

export type DeliveryErrorDisposition =
  | { disposition: "retryable"; error: GravityOutboxError }
  | { disposition: "auth"; error: GravityOutboxError }
  | { disposition: "terminal"; error: GravityOutboxError };

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
