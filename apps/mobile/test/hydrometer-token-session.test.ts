import assert from "node:assert/strict";
import test from "node:test";
import {
  createHydrometerTokenSession,
  type HydrometerTokenState
} from "../src/hydrometers/token-session";
function deferred() {
  let resolve!: (token: string) => void;
  const promise = new Promise<string>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
test("tokens are fetched deliberately, hidden immediately, and never re-revealed by a late response", async () => {
  const states: HydrometerTokenState[] = [];
  const session = createHydrometerTokenSession((state) => states.push(state));
  let calls = 0;
  await session.load(async () => {
    calls++;
    return "test-only";
  });
  assert.equal(calls, 0);
  session.activate();
  const pending = deferred();
  const operation = session.load(() => pending.promise);
  session.hide();
  pending.resolve("test-only");
  await operation;
  assert.equal(states.at(-1)?.token, undefined);
  assert.equal(
    states.some((state) => state.token === "test-only"),
    false
  );
});
test("blur and refocus during a pending request keep the old response hidden and prevent duplicate generation", async () => {
  const states: HydrometerTokenState[] = [];
  const session = createHydrometerTokenSession((state) => states.push(state));
  session.activate();
  const pending = deferred();
  const operation = session.load(() => pending.promise);
  session.hide();
  session.activate();
  let duplicateCalls = 0;
  await session.load(async () => {
    duplicateCalls++;
    return "duplicate-test";
  });
  assert.equal(duplicateCalls, 0);
  pending.resolve("old-test");
  await operation;
  assert.deepEqual(states.at(-1), { token: undefined, busy: false, failed: false });
  await session.load(async () => "new-test");
  assert.equal(states.at(-1)?.token, "new-test");
  session.hide();
  assert.equal(states.at(-1)?.token, undefined);
});
test("empty tokens and generic failures are distinct without retaining error details", async () => {
  let state!: HydrometerTokenState;
  const session = createHydrometerTokenSession((next) => {
    state = next;
  });
  session.activate();
  await session.load(async () => null);
  assert.equal(state.token, null);
  assert.equal(state.failed, false);
  await session.load(async () => {
    throw new Error("test-only-private-details");
  });
  assert.deepEqual(state, { token: undefined, busy: false, failed: true });
});
