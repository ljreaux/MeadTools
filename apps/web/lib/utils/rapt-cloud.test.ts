import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRaptCloudPayload } from "../rapt-cloud";

const stream = {
  event: "telemetry",
  deviceId: "sample-pill",
  deviceType: "PillHydrometer",
  name: "RAPT Pill",
  timestamp: "2026-10-17T16:19:17.686Z",
  data: { temperature: 20, gravity: 1.05, battery: 100, rssi: -60 },
};

test("Brew Stream envelope uses the query token and nested readings", () => {
  const result = normalizeRaptCloudPayload(stream, "test-token");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.data, {
    token: "test-token", name: "RAPT Pill", temperature: 20,
    gravity: 1.05, battery: 100, temp_units: "C", angle: undefined, interval: undefined,
  });
});

test("legacy flat payloads keep body authentication and explicit units", () => {
  const result = normalizeRaptCloudPayload({
    token: "body-token", name: "old pill", temperature: 68, gravity: 1.01, temp_units: "F",
  }, null);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.token, "body-token");
  assert.equal(result.data.temperature, 68);
  assert.equal(result.data.temp_units, "F");
});

test("query authentication takes precedence and explicit Celsius stays Celsius", () => {
  const result = normalizeRaptCloudPayload({
    token: "body-token", name: "old pill", temperature: 20,
    gravity: 1.01, temp_units: "C",
  }, "query-token");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.token, "query-token");
  assert.equal(result.data.temperature, 20);
  assert.equal(result.data.temp_units, "C");
});

test("legacy flat payloads also accept a query token without a body token", () => {
  const result = normalizeRaptCloudPayload({
    name: "old pill", temperature: 68, gravity: 1.01,
  }, "query-token");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.token, "query-token");
  assert.equal(result.data.temp_units, "F");
});

test("missing authentication and invalid telemetry fail before database writes", () => {
  assert.deepEqual(normalizeRaptCloudPayload(stream, null), { success: false, error: "Missing token" });
  for (const body of [null, {}, { ...stream, data: { gravity: "bad", temperature: 20 } }]) {
    assert.deepEqual(normalizeRaptCloudPayload(body, "test-token"), { success: false, error: "Invalid payload" });
  }
});
