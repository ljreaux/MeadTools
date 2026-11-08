import assert from "node:assert/strict";
import test from "node:test";

import type { BrewTimelineItem } from "@meadtools/brew-domain";

import {
  createGravityOutboxRecord,
  withDelivery,
  type GravityOutboxDelivery,
  type GravityOutboxRecord
} from "../src/outbox/gravity-outbox-record";
import {
  mergeTimelineWithOutbox,
  presentDelivery
} from "../src/outbox/timeline-delivery";

const ACCOUNT = { userId: 1, apiOrigin: "https://meadtools.example" };

function record(
  id: number,
  measuredAt: string,
  delivery: Partial<GravityOutboxDelivery> = {}
): GravityOutboxRecord {
  const base = createGravityOutboxRecord({
    account: ACCOUNT,
    input: { brewId: "brew-1", gravity: 1.02, measuredAt, note: "Queued" },
    clientEntryId: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    now: Date.parse("2026-11-08T12:00:00.000Z")
  });
  return withDelivery(base, delivery);
}

function serverItem(id: string, datetime: string): BrewTimelineItem {
  return {
    id,
    datetime,
    type: "NOTE",
    title: "Note",
    note: "Server",
    stage: "PRIMARY",
    detail: null
  };
}

test("each delivery state has an honest message and the right actions", () => {
  const cases: Array<[Partial<GravityOutboxDelivery>, ReturnType<typeof presentDelivery>]> = [
    [{ status: "pending" }, { message: "pending", tone: "pending", busy: false, canRetry: false, canDiscard: true }],
    [{ status: "sending" }, { message: "sending", tone: "pending", busy: true, canRetry: false, canDiscard: false }],
    [
      { status: "retryable_failure", error: { kind: "network", status: null } },
      { message: "retryNetwork", tone: "warning", busy: false, canRetry: true, canDiscard: true }
    ],
    [
      { status: "retryable_failure", error: { kind: "server", status: 503 } },
      { message: "retryServer", tone: "warning", busy: false, canRetry: true, canDiscard: true }
    ],
    [
      { status: "auth_required", error: { kind: "auth", status: 401 } },
      { message: "authRequired", tone: "warning", busy: false, canRetry: true, canDiscard: true }
    ],
    [
      { status: "terminal_failure", error: { kind: "validation", status: 400 } },
      { message: "rejected", tone: "error", busy: false, canRetry: true, canDiscard: true }
    ],
    [
      { status: "terminal_failure", error: { kind: "not_found", status: 404 } },
      { message: "notFound", tone: "error", busy: false, canRetry: true, canDiscard: true }
    ],
    [
      { status: "terminal_failure", error: { kind: "conflict", status: 409 } },
      { message: "conflict", tone: "error", busy: false, canRetry: true, canDiscard: true }
    ],
    [
      { status: "terminal_failure", error: { kind: "forbidden", status: 403 } },
      { message: "forbidden", tone: "error", busy: false, canRetry: true, canDiscard: true }
    ],
    [
      { status: "terminal_failure", error: { kind: "contract", status: null } },
      { message: "unconfirmed", tone: "error", busy: false, canRetry: true, canDiscard: true }
    ],
    [{ status: "synchronized" }, { message: "synced", tone: "success", busy: false, canRetry: false, canDiscard: false }]
  ];

  for (const [delivery, expected] of cases) {
    assert.deepEqual(presentDelivery(record(1, "2026-11-08T10:00:00.000Z", delivery)), expected);
  }
});

test("queued readings appear in the timeline newest first with their measurement time", () => {
  const rows = mergeTimelineWithOutbox(
    [serverItem("server-a", "2026-11-08T11:00:00.000Z"), serverItem("server-b", "2026-11-08T08:00:00.000Z")],
    [record(1, "2026-11-08T09:00:00.000Z"), record(2, "2026-11-08T12:30:00.000Z", { status: "sending" })],
    "SECONDARY"
  );

  assert.deepEqual(rows.map((row) => row.key), [
    "local:00000000-0000-4000-8000-000000000002",
    "server:server-a",
    "local:00000000-0000-4000-8000-000000000001",
    "server:server-b"
  ]);
  const local = rows[0];
  assert.equal(local.kind, "local");
  if (local.kind !== "local") return;
  assert.equal(local.item.datetime, "2026-11-08T12:30:00.000Z");
  assert.equal(local.item.stage, "SECONDARY");
  assert.deepEqual(local.item.detail, { kind: "gravity", value: 1.02, role: "GENERAL" });
  assert.equal(local.item.note, "Queued");
  assert.equal(local.delivery.message, "sending");
});

test("pending → synchronized never shows the reading twice", () => {
  const pending = record(1, "2026-11-08T09:00:00.000Z");
  const before = mergeTimelineWithOutbox([], [pending], "PRIMARY");
  assert.deepEqual(before.map((row) => row.kind), ["local"]);

  // The server timeline now contains the same UUID while the record is still
  // retained as synchronized (or even stale pending): only the server row shows.
  const serverCopy = { ...serverItem(pending.clientEntryId, pending.measuredAt), type: "GRAVITY" as const };
  for (const status of ["synchronized", "pending", "retryable_failure"] as const) {
    const after = mergeTimelineWithOutbox(
      [serverCopy],
      [withDelivery(pending, { status })],
      "PRIMARY"
    );
    assert.deepEqual(after.map((row) => row.key), [`server:${pending.clientEntryId}`]);
  }
});

test("a confirmed record missing from the server view is shown as synchronized", () => {
  const rows = mergeTimelineWithOutbox(
    [],
    [record(1, "2026-11-08T09:00:00.000Z", { status: "synchronized" })],
    null
  );
  assert.equal(rows[0].kind, "local");
  if (rows[0].kind !== "local") return;
  assert.equal(rows[0].delivery.message, "synced");
});

test("failed rows keep their recovery actions", () => {
  const rows = mergeTimelineWithOutbox(
    [],
    [record(1, "2026-11-08T09:00:00.000Z", {
      status: "terminal_failure",
      error: { kind: "not_found", status: 404 }
    })],
    null
  );
  assert.equal(rows[0].kind, "local");
  if (rows[0].kind !== "local") return;
  assert.equal(rows[0].delivery.canRetry, true);
  assert.equal(rows[0].delivery.canDiscard, true);
  assert.equal(rows[0].delivery.tone, "error");
});
