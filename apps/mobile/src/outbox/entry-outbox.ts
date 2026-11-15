import type { BrewResponse } from "@meadtools/api-contract";

import {
  classifyDeliveryError,
  createOutboxRecord,
  outboxAccountKey,
  withDelivery,
  type EnqueueEntryInput,
  type BrewEntryRequest,
  type OutboxError,
  type BrewEntryOutboxRecord,
  type OutboxAccount
} from "./entry-outbox-record";
import { compareRecords, type OutboxStore } from "./entry-outbox-store";

/**
 * What prompted a replay. Timer replays honor retry backoff; every other
 * trigger signals that conditions may have changed and retries immediately.
 */
export type ReplayTrigger =
  | "session"
  | "resume"
  | "reconnect"
  | "enqueue"
  | "manual"
  | "timer";

export type SendBrewEntry = (input: {
  brewId: string;
  request: BrewEntryRequest;
  accessToken: string;
}) => Promise<BrewResponse>;

export type BrewEntryOutboxOptions = {
  account: OutboxAccount;
  store: OutboxStore;
  /**
   * Returns a usable access token that belongs to `account`, refreshing it if
   * needed. Returns null when this account has no usable session (signed out,
   * another account signed in, or the refresh token was rejected). Throws for
   * a transport failure so the attempt is treated as retryable.
   */
  getAccessToken(account: OutboxAccount): Promise<string | null>;
  /** Sends with the given token only; never reads the current session. */
  send: SendBrewEntry;
  randomUUID(): string;
  now?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => () => void;
  onSynchronized?: (record: BrewEntryOutboxRecord, brew: BrewResponse) => void;
  onAuthRejected?: (account: OutboxAccount) => void;
  onStorageError?: (error: unknown) => void;
  retry?: { baseDelayMs: number; maxDelayMs: number };
  /** How long a confirmed record waits for the server timeline to show it. */
  synchronizedRetentionMs?: number;
  locks?: AccountLocks;
};

export type BrewEntryOutbox = {
  readonly account: OutboxAccount;
  /** Loads persisted records for this account. Safe to call repeatedly. */
  load(): Promise<void>;
  /** Records for this account, oldest first. Stable until the next change. */
  getSnapshot(): readonly BrewEntryOutboxRecord[];
  subscribe(listener: () => void): () => void;
  /** True when a record could still be delivered automatically. */
  hasDeliverableWork(): boolean;
  /** Validates and persists an entry, then starts delivery. */
  enqueue(input: EnqueueEntryInput): Promise<BrewEntryOutboxRecord>;
  /** Replays eligible records. Concurrent calls share one serialized run. */
  replay(trigger: ReplayTrigger): Promise<void>;
  /** User-requested retry, including for terminal failures. */
  retry(clientEntryId: string): Promise<boolean>;
  /** User-confirmed removal of an unsent entry. Refuses while sending. */
  discard(clientEntryId: string): Promise<boolean>;
  /**
   * Retires records that the server timeline for `brewId` already contains.
   * This also resolves a lost acknowledgement without another upload.
   */
  acknowledgeServerEntries(
    brewId: string,
    entryIds: Iterable<string>
  ): Promise<void>;
  /**
   * Stops automatic delivery: cancels timers and starts no new upload. An
   * upload already in flight completes and records its result.
   */
  dispose(): void;
  /** Re-enables delivery after `dispose` (for example, a React remount). */
  start(): void;
};

export type AccountLocks = {
  run<T>(key: string, task: () => Promise<T>): Promise<T>;
};

/** Serializes tasks per key; tasks for different keys run independently. */
export function createAccountLocks(): AccountLocks {
  const tails = new Map<string, Promise<void>>();

  return {
    async run(key, task) {
      const previous = tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      const tail = previous.then(() => current);
      tails.set(key, tail);

      await previous;
      try {
        return await task();
      } finally {
        release();
        if (tails.get(key) === tail) tails.delete(key);
      }
    }
  };
}

/**
 * Upload passes for one account are serialized across every outbox instance
 * in the process, so a remounted provider cannot race an in-flight upload.
 */
const processAccountLocks = createAccountLocks();

function createMutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  };
}

const DEFAULT_RETRY = { baseDelayMs: 5_000, maxDelayMs: 5 * 60_000 };
const DEFAULT_SYNCHRONIZED_RETENTION_MS = 7 * 24 * 60 * 60_000;
const UNSENT_STATUSES = new Set([
  "pending",
  "sending",
  "retryable_failure",
  "auth_required"
]);

export function retryDelayMs(
  attempts: number,
  policy: { baseDelayMs: number; maxDelayMs: number } = DEFAULT_RETRY
) {
  const exponent = Math.min(Math.max(attempts, 1) - 1, 16);
  return Math.min(policy.baseDelayMs * 2 ** exponent, policy.maxDelayMs);
}

type QueuedReplay = {
  trigger: ReplayTrigger;
  /** Attempt sequence when the trigger fired. */
  sequence: number;
};

function isEligible(
  record: BrewEntryOutboxRecord,
  replay: QueuedReplay,
  now: number,
  lastAttemptSequence: number
) {
  // A trigger causes at most one attempt per failed record after it fires,
  // so triggers that coalesce behind a running pass do not repeat its work.
  const notAttemptedSinceTrigger = lastAttemptSequence <= replay.sequence;

  switch (record.delivery.status) {
    case "pending":
    case "sending":
      // A persisted "sending" record seen at the start of a serialized pass
      // belongs to an attempt that was interrupted; replay it with its UUID.
      return true;
    case "auth_required":
      return replay.trigger !== "timer" && notAttemptedSinceTrigger;
    case "retryable_failure":
      return replay.trigger === "timer"
        ? record.delivery.nextAttemptAt === null ||
            Date.parse(record.delivery.nextAttemptAt) <= now
        : notAttemptedSinceTrigger;
    case "terminal_failure":
    case "synchronized":
      return false;
  }
}

export function createBrewEntryOutbox(
  options: BrewEntryOutboxOptions
): BrewEntryOutbox {
  const account = {
    userId: options.account.userId,
    apiOrigin: options.account.apiOrigin
  };
  const accountKey = outboxAccountKey(account);
  const store = options.store;
  const now = options.now ?? Date.now;
  const setTimer =
    options.setTimer ??
    ((callback: () => void, delayMs: number) => {
      const handle = setTimeout(callback, delayMs);
      return () => clearTimeout(handle);
    });
  const retryPolicy = options.retry ?? DEFAULT_RETRY;
  const retentionMs =
    options.synchronizedRetentionMs ?? DEFAULT_SYNCHRONIZED_RETENTION_MS;
  const locks = options.locks ?? processAccountLocks;
  const mutate = createMutex();

  const records = new Map<string, BrewEntryOutboxRecord>();
  const listeners = new Set<() => void>();
  let snapshot: readonly BrewEntryOutboxRecord[] = [];
  let disposed = false;
  let loaded: Promise<void> | null = null;
  let running: Promise<void> | null = null;
  let queued: QueuedReplay | null = null;
  let cancelTimer: (() => void) | null = null;
  let attemptSequence = 0;
  const lastAttempt = new Map<string, number>();

  function emit() {
    snapshot = [...records.values()].sort(compareRecords);
    for (const listener of listeners) listener();
  }

  /** Disk first, memory second: memory is never ahead of durable state. */
  async function write(record: BrewEntryOutboxRecord) {
    await store.put(record);
    records.set(record.clientEntryId, record);
    emit();
    return record;
  }

  async function erase(clientEntryId: string) {
    await store.remove(account, clientEntryId);
    records.delete(clientEntryId);
    emit();
  }

  async function reload() {
    const stored = await store.list(account);
    const cutoff = now() - retentionMs;
    records.clear();
    for (const record of stored) {
      const synchronizedAt = record.delivery.synchronizedAt;
      if (
        record.delivery.status === "synchronized" &&
        synchronizedAt !== null &&
        Date.parse(synchronizedAt) < cutoff
      ) {
        await store.remove(account, record.clientEntryId);
        continue;
      }
      records.set(record.clientEntryId, record);
    }
    emit();
  }

  function load() {
    loaded ??= mutate(reload).catch((error: unknown) => {
      loaded = null;
      throw error;
    });
    return loaded;
  }

  function scheduleTimer() {
    cancelTimer?.();
    cancelTimer = null;
    if (disposed) return;

    let earliest: number | null = null;
    for (const record of records.values()) {
      if (record.delivery.status !== "retryable_failure") continue;
      const at = record.delivery.nextAttemptAt
        ? Date.parse(record.delivery.nextAttemptAt)
        : now();
      earliest = earliest === null ? at : Math.min(earliest, at);
    }
    if (earliest === null) return;

    cancelTimer = setTimer(() => {
      cancelTimer = null;
      void replay("timer");
    }, Math.max(0, earliest - now()));
  }

  async function markFailure(
    record: BrewEntryOutboxRecord,
    status: "retryable_failure" | "auth_required" | "terminal_failure",
    error: OutboxError
  ) {
    const nextAttemptAt =
      status === "retryable_failure"
        ? new Date(
            now() + retryDelayMs(Math.max(record.delivery.attempts, 1), retryPolicy)
          ).toISOString()
        : null;
    return mutate(() => write(withDelivery(record, { status, error, nextAttemptAt })));
  }

  async function pauseForAuthentication() {
    await mutate(async () => {
      for (const record of [...records.values()]) {
        if (
          UNSENT_STATUSES.has(record.delivery.status) &&
          record.delivery.status !== "auth_required"
        ) {
          await write(
            withDelivery(record, {
              status: "auth_required",
              error: { kind: "auth", status: null },
              nextAttemptAt: null
            })
          );
        }
      }
    });
  }

  /** Returns false when the pass should stop. */
  async function attempt(candidate: BrewEntryOutboxRecord): Promise<boolean> {
    lastAttempt.set(candidate.clientEntryId, ++attemptSequence);

    let accessToken: string | null;
    try {
      accessToken = await options.getAccessToken(account);
    } catch (error) {
      const current = records.get(candidate.clientEntryId);
      if (current && current.delivery === candidate.delivery) {
        await markFailure(current, "retryable_failure", classifyDeliveryError(error).error);
      }
      return false;
    }

    if (accessToken === null) {
      await pauseForAuthentication();
      return false;
    }
    if (disposed) return false;

    const sending = await mutate(async () => {
      const current = records.get(candidate.clientEntryId);
      if (!current || current.delivery !== candidate.delivery) return null;
      return write(
        withDelivery(current, {
          status: "sending",
          attempts: current.delivery.attempts + 1,
          lastAttemptAt: new Date(now()).toISOString(),
          nextAttemptAt: null,
          error: null
        })
      );
    });
    if (!sending) return true;

    let brew: BrewResponse;
    try {
      brew = await options.send({
        brewId: sending.brewId,
        request: sending.request,
        accessToken
      });
    } catch (error) {
      const outcome = classifyDeliveryError(error);
      if (outcome.disposition === "auth") {
        await markFailure(sending, "auth_required", outcome.error);
        if (!disposed) options.onAuthRejected?.(account);
        return false;
      }
      if (outcome.disposition === "retryable") {
        await markFailure(sending, "retryable_failure", outcome.error);
        return false;
      }
      await markFailure(sending, "terminal_failure", outcome.error);
      return true;
    }

    const synchronized = await mutate(() =>
      write(
        withDelivery(sending, {
          status: "synchronized",
          synchronizedAt: new Date(now()).toISOString(),
          nextAttemptAt: null,
          error: null
        })
      )
    );

    if (!disposed) {
      try {
        options.onSynchronized?.(synchronized, brew);
      } catch {
        // A cache update failure must not undo a confirmed delivery.
      }
    }

    if (brew.entries.some((entry) => entry.id === synchronized.clientEntryId)) {
      await mutate(async () => {
        if (records.get(synchronized.clientEntryId) === synchronized) {
          await erase(synchronized.clientEntryId);
        }
      });
    }
    return true;
  }

  async function pass(replayRequest: QueuedReplay) {
    await locks.run(accountKey, async () => {
      if (disposed) return;
      try {
        await mutate(reload);
        loaded ??= Promise.resolve();

        const attempted = new Set<string>();
        while (!disposed) {
          const at = now();
          const candidate = [...records.values()]
            .sort(compareRecords)
            .find(
              (record) =>
                !attempted.has(record.clientEntryId) &&
                isEligible(
                  record,
                  replayRequest,
                  at,
                  lastAttempt.get(record.clientEntryId) ?? 0
                )
            );
          if (!candidate) break;
          attempted.add(candidate.clientEntryId);
          if (!(await attempt(candidate))) break;
        }
      } catch (error) {
        options.onStorageError?.(error);
      } finally {
        scheduleTimer();
      }
    });
  }

  function replay(trigger: ReplayTrigger): Promise<void> {
    if (disposed) return Promise.resolve();
    // Coalesce triggers behind a running pass into one follow-up pass. A
    // timer trigger never downgrades an immediate one.
    if (!(trigger === "timer" && queued && queued.trigger !== "timer")) {
      queued = { trigger, sequence: attemptSequence };
    }

    running ??= (async () => {
      try {
        while (queued !== null && !disposed) {
          const next = queued;
          queued = null;
          await pass(next);
        }
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    account,
    load,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hasDeliverableWork() {
      for (const record of records.values()) {
        if (UNSENT_STATUSES.has(record.delivery.status)) return true;
      }
      return false;
    },

    async enqueue(input) {
      if (disposed) throw new Error("Brew entry outbox is closed");
      const record = createOutboxRecord({
        account,
        input,
        clientEntryId: options.randomUUID(),
        now: now()
      });
      await load();
      await mutate(() => write(record));
      void replay("enqueue");
      return record;
    },

    replay,

    async retry(clientEntryId) {
      await load();
      const updated = await mutate(async () => {
        const record = records.get(clientEntryId);
        if (
          !record ||
          record.delivery.status === "sending" ||
          record.delivery.status === "synchronized"
        ) {
          return false;
        }
        await write(
          withDelivery(record, { status: "pending", nextAttemptAt: null, error: null })
        );
        return true;
      });
      if (updated) await replay("manual");
      return updated;
    },

    async discard(clientEntryId) {
      await load();
      return mutate(async () => {
        const record = records.get(clientEntryId);
        if (!record || record.delivery.status === "sending") return false;
        await erase(clientEntryId);
        return true;
      });
    },

    async acknowledgeServerEntries(brewId, entryIds) {
      const ids = new Set(entryIds);
      await load();
      await mutate(async () => {
        for (const record of [...records.values()]) {
          if (
            record.brewId === brewId &&
            ids.has(record.clientEntryId) &&
            record.delivery.status !== "sending"
          ) {
            await erase(record.clientEntryId);
          }
        }
      });
    },

    dispose() {
      disposed = true;
      queued = null;
      cancelTimer?.();
      cancelTimer = null;
    },

    start() {
      disposed = false;
    }
  };
}
