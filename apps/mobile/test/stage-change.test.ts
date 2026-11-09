import assert from "node:assert/strict";
import test from "node:test";

import { MeadToolsApiError } from "@meadtools/api-client";
import { entryPayload } from "@meadtools/brew-domain/entry-payload";
import { stageMoveDecision } from "@meadtools/brew-domain/stage-flow";

import { createAccountLocks, createBrewEntryOutbox } from "../src/outbox/entry-outbox";
import {
  classifyDeliveryError,
  createOutboxRecord,
  OutboxValidationError,
  withDelivery,
  type BrewEntryOutboxRecord,
  type EnqueueEntryInput
} from "../src/outbox/entry-outbox-record";
import { createFileOutboxStore } from "../src/outbox/entry-outbox-store";
import {
  buildStageChangeInput,
  effectiveStage,
  hasPendingStageChange,
  stageAt,
  stageContextFor
} from "../src/outbox/stage-change";
import { mergeTimelineWithOutbox, presentDelivery } from "../src/outbox/timeline-delivery";
import {
  ACCOUNT_A,
  createClock,
  createFakeServer,
  createMemoryFileSystem,
  uuidSequence
} from "./support/outbox-fakes";

const ACCOUNT = { userId: 7, apiOrigin: "https://preview.meadtools.example" };

function record(input: EnqueueEntryInput, id = 1, createdAt = "2026-11-08T12:00:00.000Z") {
  return createOutboxRecord({
    account: ACCOUNT,
    input,
    clientEntryId: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    now: Date.parse(createdAt)
  });
}

function move(to: Parameters<typeof buildStageChangeInput>[0]["to"], from: Parameters<typeof buildStageChangeInput>[0]["from"], at = "2026-11-08T12:00:00.000Z") {
  return buildStageChangeInput({ brewId: "brew-a", to, from, measuredAt: new Date(at) });
}

function setup() {
  const server = createFakeServer();
  const clock = createClock();
  const outbox = createBrewEntryOutbox({
    account: ACCOUNT_A,
    store: createFileOutboxStore(createMemoryFileSystem().fileSystem),
    send: server.send,
    randomUUID: uuidSequence(),
    now: clock.now,
    setTimer: clock.setTimer,
    locks: createAccountLocks(),
    getAccessToken: async () => "token-a"
  });
  return { server, outbox };
}

test("a queued stage change keeps its target, expected stage and time", () => {
  const queued = record(move("SECONDARY", "PRIMARY", "2026-11-08T09:30:00.000Z"));
  assert.deepEqual(queued.request, {
    type: "STAGE_CHANGE",
    stage_to: "SECONDARY",
    expected_stage: "PRIMARY",
    datetime: "2026-11-08T09:30:00.000Z",
    client_entry_id: queued.clientEntryId
  });
  assert.equal(queued.measuredAt, "2026-11-08T09:30:00.000Z");
});

test("stage changes without an expected stage, or to the same stage, are refused", () => {
  const noExpected = {
    brewId: "brew-a",
    payload: { type: "STAGE_CHANGE", stage_to: "SECONDARY", datetime: "2026-11-08T12:00:00.000Z" }
  } as unknown as EnqueueEntryInput;
  assert.throws(() => record(noExpected), OutboxValidationError);
  assert.throws(() => record(move("PRIMARY", "PRIMARY")), OutboxValidationError);

  // Other entry types cannot smuggle a stage change.
  const datetime = "2026-11-08T12:00:00.000Z";
  const sneaky = {
    brewId: "brew-a",
    payload: { ...entryPayload.note("Hi", null, null, datetime), datetime, stage_to: "COMPLETE" }
  } as unknown as EnqueueEntryInput;
  assert.throws(() => record(sneaky), OutboxValidationError);
});

test("a typed stage conflict is distinguished from a UUID conflict", () => {
  const stage = classifyDeliveryError(
    new MeadToolsApiError(409, { error: "Brew stage changed", code: "STAGE_CONFLICT", current_stage: "BULK_AGE" })
  );
  assert.deepEqual(stage, { disposition: "terminal", error: { kind: "stage_conflict", status: 409 } });
  const uuid = classifyDeliveryError(new MeadToolsApiError(409, { error: "Entry ID is already in use" }));
  assert.deepEqual(uuid, { disposition: "terminal", error: { kind: "conflict", status: 409 } });
});

test("chained offline stage changes apply in order once connectivity returns", async () => {
  const { server, outbox } = setup();
  server.faults.push({ kind: "offline" });

  await outbox.enqueue(move("SECONDARY", "PRIMARY", "2026-11-08T09:00:00.000Z"));
  await outbox.replay("enqueue");
  // The next move is queued from the effective (not yet synced) stage.
  const from = effectiveStage("PRIMARY", outbox.getSnapshot());
  assert.equal(from, "SECONDARY");
  await outbox.enqueue(move("BULK_AGE", from, "2026-11-08T10:00:00.000Z"));
  await outbox.replay("reconnect");

  assert.equal(server.stages.get("brew-a"), "BULK_AGE");
  assert.equal([...server.entries.values()].filter((entry) => entry.body.type === "STAGE_CHANGE").length, 2);
  assert.deepEqual(outbox.getSnapshot(), []);
});

test("a stage change whose response was lost replays without moving the brew twice", async () => {
  const { server, outbox } = setup();
  server.faults.push({ kind: "lose-response" });

  await outbox.enqueue(move("SECONDARY", "PRIMARY"));
  await outbox.replay("enqueue");
  assert.equal(server.stages.get("brew-a"), "SECONDARY");
  assert.equal(outbox.getSnapshot()[0].delivery.status, "retryable_failure");

  // The retry still says it expected PRIMARY; the server recognizes the UUID.
  await outbox.replay("resume");
  assert.equal(server.requests.length, 2);
  assert.equal(server.requests[0].body, server.requests[1].body);
  assert.equal(server.stages.get("brew-a"), "SECONDARY");
  assert.equal(server.entries.size, 1);
  assert.deepEqual(outbox.getSnapshot(), []);
});

test("a stale stage change stops for review without blocking other entries", async () => {
  const { server, outbox } = setup();
  server.stages.set("brew-a", "BULK_AGE"); // moved on the web while offline

  const stale = await outbox.enqueue(move("SECONDARY", "PRIMARY"));
  const datetime = "2026-11-08T12:05:00.000Z";
  await outbox.enqueue({ brewId: "brew-a", payload: { ...entryPayload.ph(3.4, null, datetime), datetime } });
  await outbox.replay("reconnect");

  assert.equal(server.stages.get("brew-a"), "BULK_AGE");
  const [conflicted] = outbox.getSnapshot();
  assert.equal(conflicted.clientEntryId, stale.clientEntryId);
  assert.deepEqual(conflicted.delivery.error, { kind: "stage_conflict", status: 409 });
  const delivery = presentDelivery(conflicted);
  assert.equal(delivery.message, "stageConflict");
  assert.equal(delivery.canRetry, false);
  assert.equal(delivery.canDiscard, true);
  // The pH reading behind it still delivered.
  assert.equal([...server.entries.values()].some((entry) => entry.body.type === "PH"), true);
  // A conflicted change no longer counts toward the effective stage.
  assert.equal(effectiveStage("BULK_AGE", outbox.getSnapshot()), "BULK_AGE");
  assert.equal(hasPendingStageChange(outbox.getSnapshot()), false);

  for (const trigger of ["resume", "reconnect", "timer"] as const) await outbox.replay(trigger);
  assert.equal(server.stages.get("brew-a"), "BULK_AGE");
});

test("the stage-move context counts queued OG and volume like the web tracker", () => {
  const brew = { stage: "PRIMARY" as const, recipe_id: null, current_volume_liters: null, entries: [] };
  assert.deepEqual(stageContextFor(brew, []), {
    hasRecipeLinked: false,
    hasOriginalGravity: false,
    hasPackagingEntry: false,
    hasPackagedVolume: false
  });
  assert.deepEqual(stageMoveDecision("SECONDARY", "PRIMARY", stageContextFor(brew, [])).unmet, ["originalGravity"]);

  const datetime = "2026-11-08T08:00:00.000Z";
  const og = record({
    brewId: "brew-a",
    payload: { ...entryPayload.gravity(1.1, null, { readingRole: "OG", datetime }), datetime }
  });
  const volume = record({
    brewId: "brew-a",
    payload: { ...entryPayload.volume({ liters: 19, datetime }), datetime }
  }, 2);
  const context = stageContextFor({ ...brew, recipe_id: 3 }, [og, volume]);
  assert.equal(context.hasRecipeLinked, true);
  assert.equal(context.hasOriginalGravity, true);
  assert.equal(context.hasPackagedVolume, true);
  assert.equal(stageMoveDecision("SECONDARY", "PRIMARY", context).allowed, true);

  // A rejected OG does not unblock the move.
  const rejected = withDelivery(og, { status: "terminal_failure", error: { kind: "validation", status: 400 } });
  assert.equal(stageContextFor(brew, [rejected]).hasOriginalGravity, false);

  const packaged = stageContextFor(
    { ...brew, entries: [{ type: "PACKAGING", datetime, gravity: null, data: { packagedVolumeLiters: 18 } }] },
    []
  );
  assert.equal(packaged.hasPackagingEntry, true);
  assert.equal(packaged.hasPackagedVolume, true);
});

test("queued rows show the stage move and the stage each entry belongs to", () => {
  const change = record(move("SECONDARY", "PRIMARY", "2026-11-08T10:00:00.000Z"), 1);
  const datetime = "2026-11-08T11:00:00.000Z";
  const later = record({ brewId: "brew-a", payload: { ...entryPayload.ph(3.5, null, datetime), datetime } }, 2);
  const records: BrewEntryOutboxRecord[] = [change, later];

  assert.equal(stageAt("2026-11-08T09:00:00.000Z", "PRIMARY", records), "PRIMARY");
  assert.equal(stageAt("2026-11-08T11:00:00.000Z", "PRIMARY", records), "SECONDARY");

  const rows = mergeTimelineWithOutbox([], records, "PRIMARY");
  const stageRow = rows.find((row) => row.item.type === "STAGE_CHANGE");
  assert.deepEqual(stageRow?.item.detail, { kind: "stage", from: "PRIMARY", to: "SECONDARY" });
  const phRow = rows.find((row) => row.item.type === "PH");
  assert.equal(phRow?.item.stage, "SECONDARY");
});
