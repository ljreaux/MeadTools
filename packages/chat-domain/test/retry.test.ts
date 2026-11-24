import assert from "node:assert/strict";
import test from "node:test";
import { latestRetryableUserMessageId } from "../src/index";

test("the latest failed or cancelled user turn is retryable", () => {
  assert.equal(
    latestRetryableUserMessageId([
      { id: "u1", role: "user", status: "complete" },
      { id: "a1", role: "assistant", status: "complete" },
      { id: "u2", role: "user", status: "failed" },
    ]),
    "u2",
  );
  assert.equal(
    latestRetryableUserMessageId([{ id: "u1", role: "user", status: "cancelled" }]),
    "u1",
  );
});

test("a failed assistant placeholder does not hide the user turn it belongs to", () => {
  assert.equal(
    latestRetryableUserMessageId([
      { id: "u1", role: "user", status: "failed" },
      { id: "a1", role: "assistant", status: "failed" },
    ]),
    "u1",
  );
});

test("answered, pending and older failed turns are not offered", () => {
  assert.equal(latestRetryableUserMessageId([]), undefined);
  assert.equal(
    latestRetryableUserMessageId([
      { id: "u1", role: "user", status: "failed" },
      { id: "u2", role: "user", status: "complete" },
      { id: "a2", role: "assistant" },
    ]),
    undefined,
  );
  assert.equal(
    latestRetryableUserMessageId([{ id: "u1", role: "user", status: "pending" }]),
    undefined,
  );
  assert.equal(
    latestRetryableUserMessageId([{ id: "u1", role: "user" }]),
    undefined,
  );
  // A reply already arrived, e.g. a turn that finished as it was marked failed.
  assert.equal(
    latestRetryableUserMessageId([
      { id: "u1", role: "user", status: "failed" },
      { id: "a1", role: "assistant", status: "complete" },
    ]),
    undefined,
  );
});
