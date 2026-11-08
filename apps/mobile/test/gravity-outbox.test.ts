import assert from "node:assert/strict";
import test from "node:test";

import { MeadToolsApiError, MeadToolsContractError } from "@meadtools/api-client";

import {
  createAccountLocks,
  createGravityOutbox,
  retryDelayMs,
  type GravityOutboxOptions
} from "../src/outbox/gravity-outbox";
import {
  classifyDeliveryError,
  GravityOutboxValidationError,
  outboxAccountKey,
  type GravityOutboxRecord,
  type OutboxAccount
} from "../src/outbox/gravity-outbox-record";
import {
  createFileOutboxStore,
  type GravityOutboxStore
} from "../src/outbox/gravity-outbox-store";
import {
  ACCOUNT_A,
  ACCOUNT_B,
  createClock,
  createFakeServer,
  createMemoryFileSystem,
  deferred,
  flush,
  uuidSequence
} from "./support/outbox-fakes";

const READING = {
  brewId: "brew-a",
  gravity: 1.042,
  measuredAt: "2026-11-08T07:30:00.000Z",
  note: "  Before stirring  ",
  display: { enteredValue: 10.5, enteredUnit: "BRIX" as const, convertedGravity: 1.042 }
};

const TOKENS: Record<number, string> = { 7: "token-a", 8: "token-b" };

function setup(overrides: Partial<GravityOutboxOptions> & {
  account?: OutboxAccount;
  store?: GravityOutboxStore;
  server?: ReturnType<typeof createFakeServer>;
  clock?: ReturnType<typeof createClock>;
  memory?: ReturnType<typeof createMemoryFileSystem>;
  signedIn?: { current: number | null };
} = {}) {
  const memory = overrides.memory ?? createMemoryFileSystem();
  const store = overrides.store ?? createFileOutboxStore(memory.fileSystem);
  const server = overrides.server ?? createFakeServer();
  const clock = overrides.clock ?? createClock();
  const account = overrides.account ?? ACCOUNT_A;
  const signedIn = overrides.signedIn ?? { current: account.userId };
  const tokenRequests: OutboxAccount[] = [];
  const synchronized: GravityOutboxRecord[] = [];
  const authRejected: OutboxAccount[] = [];

  const outbox = createGravityOutbox({
    account,
    store,
    send: server.send,
    randomUUID: uuidSequence(),
    now: clock.now,
    setTimer: clock.setTimer,
    locks: createAccountLocks(),
    async getAccessToken(requested) {
      tokenRequests.push(requested);
      return signedIn.current === requested.userId ? TOKENS[requested.userId] : null;
    },
    onSynchronized: (record) => synchronized.push(record),
    onAuthRejected: (rejected) => authRejected.push(rejected),
    ...overrides
  });

  return {
    outbox,
    memory,
    store,
    server,
    clock,
    signedIn,
    tokenRequests,
    synchronized,
    authRejected
  };
}

function statuses(records: readonly GravityOutboxRecord[]) {
  return records.map((record) => record.delivery.status);
}

test("persists the validated shared gravity payload before sending it", async () => {
  const { outbox, memory, server } = setup();
  server.faults.push({ kind: "offline" });

  const record = await outbox.enqueue(READING);
  await outbox.replay("enqueue");

  assert.equal(record.clientEntryId, "00000000-0000-4000-8000-000000000001");
  assert.equal(record.brewId, "brew-a");
  assert.equal(record.measuredAt, "2026-11-08T07:30:00.000Z");
  assert.equal(record.createdAt, "2026-11-08T12:00:00.000Z");
  assert.deepEqual(record.account, ACCOUNT_A);
  assert.deepEqual(record.request, {
    type: "GRAVITY",
    title: "Gravity reading",
    datetime: "2026-11-08T07:30:00.000Z",
    gravity: 1.042,
    data: {
      readingRole: "GENERAL",
      source: "measured",
      display: { enteredValue: 10.5, enteredUnit: "BRIX", convertedGravity: 1.042 }
    },
    note: "Before stirring",
    client_entry_id: record.clientEntryId
  });
  assert.ok(Object.isFrozen(record.request));

  // The record reached durable storage (temp write + rename) before the
  // single network request was made, and the sent body is the stored body.
  const directory = `v1/${outboxAccountKey(ACCOUNT_A)}/gravity`;
  assert.deepEqual(memory.log.slice(0, 2), [
    `write ${directory}/${record.clientEntryId}.json.tmp`,
    `move ${directory}/${record.clientEntryId}.json.tmp -> ${directory}/${record.clientEntryId}.json`
  ]);
  assert.equal(server.requests.length, 1);
  assert.deepEqual(JSON.parse(server.requests[0].body), record.request);
});

test("rejects invalid readings without persisting or sending", async () => {
  const { outbox, memory, server } = setup();

  for (const input of [
    { ...READING, gravity: Number.NaN },
    { ...READING, gravity: 0 },
    { ...READING, gravity: Number.POSITIVE_INFINITY },
    { ...READING, measuredAt: "not a date" },
    { ...READING, brewId: "  " }
  ]) {
    await assert.rejects(outbox.enqueue(input), GravityOutboxValidationError);
  }

  await outbox.replay("manual");
  assert.equal(memory.files.size, 0);
  assert.equal(server.requests.length, 0);
  assert.deepEqual(outbox.getSnapshot(), []);
});

test("an offline reading survives restart and syncs once with the same identity", async () => {
  const memory = createMemoryFileSystem();
  const server = createFakeServer();
  const clock = createClock();
  const first = setup({ memory, server, clock });
  server.faults.push({ kind: "offline" });

  const queued = await first.outbox.enqueue(READING);
  await first.outbox.replay("enqueue");
  assert.deepEqual(statuses(first.outbox.getSnapshot()), ["retryable_failure"]);
  assert.equal(server.entries.size, 0);

  // Simulate process termination: discard all in-memory state.
  first.outbox.dispose();
  clock.advance(60 * 60_000);
  const restarted = setup({ memory, server, clock });
  await restarted.outbox.load();

  const [restored] = restarted.outbox.getSnapshot();
  assert.equal(restored.clientEntryId, queued.clientEntryId);
  assert.equal(restored.brewId, queued.brewId);
  assert.equal(restored.measuredAt, queued.measuredAt);
  assert.equal(restored.createdAt, queued.createdAt);
  assert.deepEqual(restored.request, queued.request);

  await restarted.outbox.replay("reconnect");

  assert.equal(server.entries.size, 1);
  assert.ok(server.entries.has(queued.clientEntryId));
  assert.equal(server.requests.length, 2);
  assert.equal(server.requests[0].body, server.requests[1].body);
  assert.equal(restarted.synchronized.length, 1);
  // The returned brew contains the entry, so the record is retired.
  assert.deepEqual(restarted.outbox.getSnapshot(), []);
  assert.equal(memory.files.size, 0);
});

test("a lost acknowledgement is retried with the same UUID and yields one entry", async () => {
  const { outbox, server, synchronized } = setup();
  server.faults.push({ kind: "lose-response" });

  const record = await outbox.enqueue(READING);
  await outbox.replay("enqueue");

  // The server committed, but the client only saw a transport failure.
  assert.equal(server.entries.size, 1);
  assert.deepEqual(statuses(outbox.getSnapshot()), ["retryable_failure"]);
  assert.equal(outbox.getSnapshot()[0].delivery.error?.kind, "network");

  await outbox.replay("resume");

  assert.equal(server.requests.length, 2);
  assert.deepEqual(
    server.requests.map((request) => JSON.parse(request.body).client_entry_id),
    [record.clientEntryId, record.clientEntryId]
  );
  assert.equal(server.requests[0].body, server.requests[1].body);
  assert.equal(server.entries.size, 1);
  assert.equal(synchronized.length, 1);
  assert.deepEqual(outbox.getSnapshot(), []);
});

test("a server timeline containing the UUID retires a lost acknowledgement without uploading", async () => {
  const { outbox, server } = setup();
  server.faults.push({ kind: "lose-response" });
  const record = await outbox.enqueue(READING);
  await outbox.replay("enqueue");
  assert.equal(server.requests.length, 1);

  // Another brew's timeline does not retire it.
  await outbox.acknowledgeServerEntries("brew-a2", [record.clientEntryId]);
  assert.equal(outbox.getSnapshot().length, 1);

  await outbox.acknowledgeServerEntries(
    "brew-a",
    server.brew("brew-a").entries.map((entry) => entry.id)
  );
  await outbox.replay("reconnect");

  assert.deepEqual(outbox.getSnapshot(), []);
  assert.equal(server.requests.length, 1);
  assert.equal(server.entries.size, 1);
});

test("concurrent resume, reconnect, manual and enqueue triggers send one upload", async () => {
  const { outbox, server, synchronized } = setup();
  const gate = deferred();
  server.faults.push({ kind: "hold", release: gate.promise });

  const record = await outbox.enqueue(READING);
  await flush();
  assert.equal(server.requests.length, 1);
  assert.deepEqual(statuses(outbox.getSnapshot()), ["sending"]);

  const triggers = [
    outbox.replay("resume"),
    outbox.replay("reconnect"),
    outbox.replay("manual"),
    outbox.replay("timer"),
    outbox.replay("session"),
    outbox.retry(record.clientEntryId),
    outbox.discard(record.clientEntryId)
  ];
  await flush();
  assert.equal(server.requests.length, 1, "no request may race the in-flight upload");

  gate.resolve();
  const results = await Promise.all(triggers);

  assert.equal(results[5], false, "retry is ignored while sending");
  assert.equal(results[6], false, "discard is refused while sending");
  assert.equal(server.requests.length, 1);
  assert.equal(server.entries.size, 1);
  assert.equal(synchronized.length, 1);
  assert.deepEqual(outbox.getSnapshot(), []);
});

test("two outbox instances for one account serialize uploads (provider remount)", async () => {
  const memory = createMemoryFileSystem();
  const server = createFakeServer();
  const clock = createClock();
  const locks = createAccountLocks();
  const first = setup({ memory, server, clock, locks });
  const gate = deferred();
  server.faults.push({ kind: "offline" }, { kind: "hold", release: gate.promise });

  await first.outbox.enqueue(READING);
  await first.outbox.replay("enqueue");
  assert.equal(server.requests.length, 1);

  const second = setup({ memory, server, clock, locks });
  const firstReplay = first.outbox.replay("resume");
  await flush();
  first.outbox.dispose();
  const secondReplay = second.outbox.replay("session");
  await flush();
  assert.equal(server.requests.length, 2, "the second instance waits for the in-flight upload");

  gate.resolve();
  await Promise.all([firstReplay, secondReplay]);

  assert.equal(server.requests.length, 2);
  assert.equal(server.entries.size, 1);
  assert.equal(first.synchronized.length, 0, "a disposed instance does not update the UI cache");
  assert.deepEqual(second.outbox.getSnapshot(), []);
});

test("a stopped outbox restarts without repeating an in-flight upload (StrictMode remount)", async () => {
  const { outbox, server, synchronized, clock } = setup();
  const gate = deferred();
  server.faults.push({ kind: "offline" }, { kind: "hold", release: gate.promise });

  await outbox.enqueue(READING);
  await outbox.replay("enqueue");
  assert.deepEqual(clock.pendingTimers(), [5_000]);

  // Mount → unmount → mount on the same instance while an upload is held.
  const firstMount = outbox.replay("session");
  await flush();
  outbox.dispose();
  assert.deepEqual(clock.pendingTimers(), []);
  assert.equal(await outbox.replay("resume").then(() => server.requests.length), 2);
  outbox.start();
  const secondMount = outbox.replay("session");
  await flush();
  assert.equal(server.requests.length, 2);

  gate.resolve();
  await Promise.all([firstMount, secondMount]);
  assert.equal(server.requests.length, 2);
  assert.equal(server.entries.size, 1);
  assert.equal(synchronized.length, 1);
  assert.deepEqual(outbox.getSnapshot(), []);
});

test("retryable failures back off on the timer but retry immediately on other triggers", async () => {
  const { outbox, server, clock } = setup();
  server.faults.push(
    { kind: "status", status: 503 },
    { kind: "offline" },
    { kind: "status", status: 429 }
  );

  await outbox.enqueue(READING);
  await outbox.replay("enqueue");
  let [record] = outbox.getSnapshot();
  assert.equal(record.delivery.status, "retryable_failure");
  assert.deepEqual(record.delivery.error, { kind: "server", status: 503 });
  assert.equal(record.delivery.attempts, 1);
  assert.equal(record.delivery.nextAttemptAt, "2026-11-08T12:00:05.000Z");
  assert.deepEqual(clock.pendingTimers(), [5_000]);

  // A timer replay before the backoff elapses sends nothing.
  await outbox.replay("timer");
  assert.equal(server.requests.length, 1);

  clock.advance(5_000);
  clock.runDueTimers();
  await outbox.replay("timer");
  [record] = outbox.getSnapshot();
  assert.equal(server.requests.length, 2);
  assert.equal(record.delivery.attempts, 2);
  assert.equal(record.delivery.nextAttemptAt, "2026-11-08T12:00:15.000Z");

  // Resume does not wait for the backoff.
  await outbox.replay("resume");
  assert.equal(server.requests.length, 3);
  assert.equal(outbox.getSnapshot()[0].delivery.error?.status, 429);

  await outbox.replay("reconnect");
  assert.equal(server.requests.length, 4);
  assert.equal(server.entries.size, 1);
  assert.deepEqual(outbox.getSnapshot(), []);
  assert.deepEqual(clock.pendingTimers(), []);

  assert.equal(retryDelayMs(1), 5_000);
  assert.equal(retryDelayMs(3), 20_000);
  assert.equal(retryDelayMs(50), 300_000);
});

test("terminal failures wait for the user, then retry with the same UUID or discard", async () => {
  const { outbox, server } = setup();
  server.faults.push({ kind: "status", status: 400, body: { error: "Invalid entry request" } });

  const record = await outbox.enqueue(READING);
  await outbox.replay("enqueue");
  assert.deepEqual(outbox.getSnapshot()[0].delivery.error, { kind: "validation", status: 400 });
  assert.equal(outbox.getSnapshot()[0].delivery.status, "terminal_failure");

  for (const trigger of ["resume", "reconnect", "session", "timer"] as const) {
    await outbox.replay(trigger);
  }
  assert.equal(server.requests.length, 1, "terminal failures are not replayed automatically");

  assert.equal(await outbox.retry(record.clientEntryId), true);
  assert.equal(server.requests.length, 2);
  assert.equal(server.requests[0].body, server.requests[1].body);
  assert.deepEqual(outbox.getSnapshot(), []);

  // Not found (deleted brew / lost ownership) can be discarded by the user.
  const other = await outbox.enqueue({ ...READING, brewId: "brew-b" });
  await outbox.replay("enqueue");
  assert.deepEqual(outbox.getSnapshot()[0].delivery.error, { kind: "not_found", status: 404 });
  assert.equal(await outbox.discard(other.clientEntryId), true);
  assert.deepEqual(outbox.getSnapshot(), []);
});

test("a UUID conflict and an unreadable success response are terminal", async () => {
  const server = createFakeServer();
  const { outbox } = setup({ server });
  // The same UUID already belongs to another account's entry.
  server.entries.set("00000000-0000-4000-8000-000000000001", {
    id: "00000000-0000-4000-8000-000000000001",
    brewId: "brew-b",
    userId: 8,
    body: {}
  });

  await outbox.enqueue(READING);
  await outbox.replay("enqueue");
  assert.deepEqual(outbox.getSnapshot()[0].delivery.error, { kind: "conflict", status: 409 });

  server.faults.push({ kind: "invalid-response" });
  await outbox.enqueue({ ...READING, brewId: "brew-a2" });
  await outbox.replay("enqueue");
  assert.deepEqual(statuses(outbox.getSnapshot()), ["terminal_failure", "terminal_failure"]);
  assert.deepEqual(outbox.getSnapshot()[1].delivery.error, { kind: "contract", status: null });
});

test("an expired session pauses delivery until the same account has a token", async () => {
  const signedIn = { current: null as number | null };
  const { outbox, server } = setup({ signedIn });

  await outbox.enqueue(READING);
  await outbox.enqueue({ ...READING, brewId: "brew-a2" });
  await outbox.replay("resume");
  assert.deepEqual(statuses(outbox.getSnapshot()), ["auth_required", "auth_required"]);
  assert.equal(server.requests.length, 0);

  // Backoff timers do not retry authentication.
  await outbox.replay("timer");
  assert.equal(server.requests.length, 0);

  signedIn.current = ACCOUNT_A.userId;
  await outbox.replay("session");
  assert.equal(server.requests.length, 2);
  assert.equal(server.entries.size, 2);
  assert.deepEqual(outbox.getSnapshot(), []);
});

test("a server 401 pauses the queue and reports the rejected account", async () => {
  const signedIn = { current: null as number | null };
  const { outbox, server, authRejected } = setup({ signedIn });
  await outbox.enqueue(READING);
  await outbox.enqueue({ ...READING, brewId: "brew-a2" });
  await outbox.replay("enqueue");
  assert.equal(server.requests.length, 0);

  // The token looks valid locally, but the server rejects it.
  signedIn.current = ACCOUNT_A.userId;
  server.faults.push({ kind: "status", status: 401, body: { error: "Invalid or expired token" } });
  await outbox.replay("session");

  assert.equal(server.requests.length, 1, "the pass stops after an auth rejection");
  assert.deepEqual(statuses(outbox.getSnapshot()), ["auth_required", "auth_required"]);
  assert.deepEqual(outbox.getSnapshot()[0].delivery.error, { kind: "auth", status: 401 });
  assert.deepEqual(authRejected, [ACCOUNT_A]);

  await outbox.replay("session");
  assert.equal(server.entries.size, 2);
});

test("a transport failure while refreshing the session is retryable", async () => {
  const server = createFakeServer();
  let online = false;
  const { outbox } = setup({
    server,
    async getAccessToken() {
      if (!online) throw new TypeError("Network request failed");
      return "token-a";
    }
  });

  await outbox.enqueue(READING);
  await outbox.replay("enqueue");
  assert.equal(server.requests.length, 0);
  assert.deepEqual(outbox.getSnapshot()[0].delivery.error, { kind: "network", status: null });

  online = true;
  await outbox.replay("reconnect");
  assert.equal(server.entries.size, 1);
});

test("another account never sees or uploads the previous account's queue", async () => {
  const memory = createMemoryFileSystem();
  const server = createFakeServer();
  const signedIn = { current: null as number | null };
  const a = setup({ memory, server, signedIn, account: ACCOUNT_A });

  const queued = await a.outbox.enqueue(READING);
  await a.outbox.replay("enqueue");
  assert.deepEqual(statuses(a.outbox.getSnapshot()), ["auth_required"]);
  a.outbox.dispose();

  // Account B signs in on the same device.
  signedIn.current = ACCOUNT_B.userId;
  const b = setup({ memory, server, signedIn, account: ACCOUNT_B });
  await b.outbox.load();
  await b.outbox.replay("session");
  assert.deepEqual(b.outbox.getSnapshot(), []);
  assert.equal(await b.outbox.retry(queued.clientEntryId), false);
  assert.equal(await b.outbox.discard(queued.clientEntryId), false);
  assert.equal(server.requests.length, 0);
  assert.ok(b.tokenRequests.every((account) => account.userId === ACCOUNT_B.userId));

  // The same user ID on another backend is a different account.
  const otherBackend = setup({
    memory,
    server,
    signedIn: { current: ACCOUNT_A.userId },
    account: { userId: ACCOUNT_A.userId, apiOrigin: "https://meadtools.example" }
  });
  await otherBackend.outbox.replay("session");
  assert.deepEqual(otherBackend.outbox.getSnapshot(), []);
  assert.equal(server.requests.length, 0);

  // A's reading is still there, and uploads when A signs back in.
  signedIn.current = ACCOUNT_A.userId;
  const aAgain = setup({ memory, server, signedIn, account: ACCOUNT_A });
  await aAgain.outbox.replay("session");
  assert.equal(server.requests.length, 1);
  assert.equal(server.requests[0].token, "token-a");
  assert.equal(server.entries.get(queued.clientEntryId)?.userId, ACCOUNT_A.userId);
});

test("an account switch during an upload completes it as the original account only", async () => {
  const memory = createMemoryFileSystem();
  const server = createFakeServer();
  const signedIn = { current: ACCOUNT_A.userId as number | null };
  const a = setup({ memory, server, signedIn, account: ACCOUNT_A });
  const gate = deferred();
  server.faults.push({ kind: "hold", release: gate.promise });

  await a.outbox.enqueue(READING);
  await a.outbox.enqueue({ ...READING, brewId: "brew-a2" });
  await flush();
  assert.equal(server.requests.length, 1);

  // Sign out and sign in as B while A's first upload is in flight.
  a.outbox.dispose();
  signedIn.current = ACCOUNT_B.userId;
  gate.resolve();
  await flush();

  assert.equal(server.requests.length, 1, "no new upload starts after dispose");
  assert.equal(server.requests[0].token, "token-a");
  assert.equal(a.synchronized.length, 0);
  const remaining = await createFileOutboxStore(memory.fileSystem).list(ACCOUNT_A);
  assert.deepEqual(remaining.map((record) => record.brewId), ["brew-a2"]);
  assert.deepEqual(await createFileOutboxStore(memory.fileSystem).list(ACCOUNT_B), []);
});

test("the file store recovers an interrupted rename and never deletes corrupt files", async () => {
  const memory = createMemoryFileSystem();
  const store = createFileOutboxStore(memory.fileSystem);
  const source = setup({ memory, store });
  source.server.faults.push({ kind: "offline" });
  const record = await source.outbox.enqueue(READING);
  await source.outbox.replay("enqueue");
  source.outbox.dispose();

  const directory = `v1/${outboxAccountKey(ACCOUNT_A)}/gravity`;
  const recordPath = `${directory}/${record.clientEntryId}.json`;
  const contents = memory.files.get(recordPath);
  assert.ok(contents);

  // Crash between removing the old record and renaming the new one.
  memory.files.delete(recordPath);
  memory.files.set(`${recordPath}.tmp`, contents);
  memory.files.set(`${directory}/00000000-0000-4000-8000-0000000000ff.json`, "{not json");
  memory.files.set(`${directory}/notes.txt`, "ignored");

  const recovered = await store.list(ACCOUNT_A);
  assert.deepEqual(recovered.map((item) => item.clientEntryId), [record.clientEntryId]);
  assert.equal(memory.files.get(recordPath), contents);
  assert.equal(memory.files.has(`${recordPath}.tmp`), false);
  assert.equal(
    memory.files.get(`${directory}/00000000-0000-4000-8000-0000000000ff.json`),
    "{not json"
  );

  // A record copied into another account's directory is rejected.
  memory.files.set(
    `v1/${outboxAccountKey(ACCOUNT_B)}/gravity/${record.clientEntryId}.json`,
    contents
  );
  assert.deepEqual(await store.list(ACCOUNT_B), []);
});

test("confirmed records the response did not include are retired after retention", async () => {
  const memory = createMemoryFileSystem();
  const clock = createClock();
  const server = createFakeServer();
  const first = setup({
    memory,
    clock,
    server,
    // A server response that omits the new entry (for example, a paginated
    // timeline) keeps the confirmed record until the timeline shows it.
    send: async (input) => ({ ...(await server.send(input)), entries: [] })
  });

  await first.outbox.enqueue(READING);
  await first.outbox.replay("enqueue");
  assert.deepEqual(statuses(first.outbox.getSnapshot()), ["synchronized"]);
  assert.equal(await first.outbox.retry(first.outbox.getSnapshot()[0].clientEntryId), false);
  first.outbox.dispose();

  clock.advance(7 * 24 * 60 * 60_000 + 1);
  const later = setup({ memory, clock, server });
  await later.outbox.load();
  assert.deepEqual(later.outbox.getSnapshot(), []);
  assert.equal(memory.files.size, 0);
  assert.equal(server.requests.length, 1);
});

test("subscribers receive stable snapshots for each state change", async () => {
  const { outbox, server } = setup();
  server.faults.push({ kind: "offline" });
  const seen: string[][] = [];
  outbox.subscribe(() => seen.push(statuses(outbox.getSnapshot())));

  await outbox.enqueue(READING);
  await outbox.replay("enqueue");
  const snapshot = outbox.getSnapshot();
  assert.equal(outbox.getSnapshot(), snapshot);
  assert.equal(outbox.hasDeliverableWork(), true);

  assert.deepEqual(seen.at(-1), ["retryable_failure"]);
  assert.ok(seen.some((value) => value[0] === "pending"));
  assert.ok(seen.some((value) => value[0] === "sending"));
});

test("delivery errors map to retry, pause and user-action policies", () => {
  const disposition = (error: unknown) => {
    const result = classifyDeliveryError(error);
    return `${result.disposition}:${result.error.kind}:${result.error.status}`;
  };

  assert.equal(disposition(new TypeError("Network request failed")), "retryable:network:null");
  assert.equal(disposition(new Error("aborted")), "retryable:network:null");
  assert.equal(disposition(new MeadToolsApiError(500, null)), "retryable:server:500");
  assert.equal(disposition(new MeadToolsApiError(503, null)), "retryable:server:503");
  assert.equal(disposition(new MeadToolsApiError(408, null)), "retryable:server:408");
  assert.equal(disposition(new MeadToolsApiError(429, null)), "retryable:server:429");
  assert.equal(disposition(new MeadToolsApiError(401, null)), "auth:auth:401");
  assert.equal(disposition(new MeadToolsApiError(400, null)), "terminal:validation:400");
  assert.equal(disposition(new MeadToolsApiError(403, null)), "terminal:forbidden:403");
  assert.equal(disposition(new MeadToolsApiError(404, null)), "terminal:not_found:404");
  assert.equal(disposition(new MeadToolsApiError(409, null)), "terminal:conflict:409");
  assert.equal(
    disposition(new MeadToolsContractError("Brew entry response mismatch", {})),
    "terminal:contract:null"
  );
});
