import assert from "node:assert/strict";
import test from "node:test";

import { createMeadToolsApiClient, MeadToolsApiError, MeadToolsContractError } from "../src/index";

const device = {
  id: "device-1", device_name: "iSpindel", brew_id: "brew-1", recipe_id: null,
  coefficients: [0.0001, -0.2, 1.3], brews: { id: "brew-1", name: "Traditional" }
};

test("lists owned devices with authentication, without returning the setup token", async () => {
  const client = createMeadToolsApiClient({
    baseUrl: "https://meadtools.test", getAccessToken: () => "test-access",
    fetch: async (url, init) => {
      assert.equal(url, "https://meadtools.test/api/hydrometer");
      assert.equal(init.method, "GET");
      assert.equal(init.headers.authorization, "Bearer test-access");
      return { ok: true, status: 200, json: async () => ({ hydro_token: "private-setup", devices: [device] }) };
    }
  });
  const result = await client.listHydrometerDevices();
  assert.deepEqual(result, [device]);
  assert.equal(JSON.stringify(result).includes("private-setup"), false);
});

test("accepts accounts with no token or devices and devices without an active brew", async () => {
  let body: unknown = { hydro_token: null, devices: [] };
  const client = createMeadToolsApiClient({ baseUrl: "https://meadtools.test", fetch: async () => ({ ok: true, status: 200, json: async () => body }) });
  assert.deepEqual(await client.listHydrometerDevices(), []);
  const unlinked = { ...device, device_name: null, brew_id: null, brews: null, coefficients: [] };
  body = { hydro_token: null, devices: [unlinked] };
  assert.deepEqual(await client.listHydrometerDevices(), [unlinked]);
});

test("rejects malformed devices without attaching a sensitive response to the error", async () => {
  const client = createMeadToolsApiClient({ baseUrl: "https://meadtools.test", fetch: async () => ({ ok: true, status: 200, json: async () => ({ hydro_token: "private-setup", devices: [{ ...device, coefficients: ["bad"] }] }) }) });
  await assert.rejects(client.listHydrometerDevices(), (error: unknown) => {
    assert.ok(error instanceof MeadToolsContractError);
    assert.equal(error.value, undefined);
    assert.equal(JSON.stringify(error).includes("private-setup"), false);
    return true;
  });
});

test("preserves expired-session failures for the Mobile sign-in prompt", async () => {
  const client = createMeadToolsApiClient({ baseUrl: "https://meadtools.test", fetch: async () => ({ ok: false, status: 401, json: async () => ({ error: "Unauthorized" }) }) });
  await assert.rejects(client.listHydrometerDevices(), (error: unknown) => error instanceof MeadToolsApiError && error.status === 401);
});

const log = { id: "log/1", device_id: "device/1", brew_id: "brew/1", datetime: "2026-11-27T00:00:00Z", angle: 12, gravity: 1.05, calculated_gravity: null, temperature: 20, temp_units: "C", battery: 3.7, interval: 600 };
test("log queries encode IDs and date ranges, and reject reversed ranges before transport", async () => {
  const requests: string[] = [];
  const client = createMeadToolsApiClient({ baseUrl: "https://meadtools.test", fetch: async (url) => {
    requests.push(url); return { ok: true, status: 200, json: async () => [log] };
  }});
  const range = { deviceId: "device/1", startDate: "2026-11-01T00:00:00Z", endDate: "2026-11-27T00:00:00Z" };
  assert.deepEqual(await client.listHydrometerLogs(range), [log]);
  assert.equal(new URL(requests[0]).searchParams.get("device_id"), "device/1");
  assert.deepEqual(await client.listBrewHydrometerLogs("brew/1"), [log]);
  assert.match(requests[1], /brew%2F1$/);
  await assert.rejects(client.listHydrometerLogs({ ...range, startDate: range.endDate, endDate: range.startDate }), MeadToolsContractError);
  assert.equal(requests.length, 2);
});
test("edits and deletes use a log ID distinct from the device and brew IDs", async () => {
  const requests: Array<{ url: string; method: string; body?: string }> = [];
  const client = createMeadToolsApiClient({ baseUrl: "https://meadtools.test", fetch: async (url, init) => {
    requests.push({ url, method: init.method, body: init.body });
    return { ok: true, status: 200, json: async () => log };
  }});
  await client.updateHydrometerLog("log/1", "device/1", { gravity: "1.06", dateTime: "2026-11-27T01:00:00Z" });
  assert.equal(requests[0].method, "PATCH");
  assert.match(requests[0].url, /logs\/log%2F1\?device_id=device%2F1$/);
  assert.equal(JSON.parse(requests[0].body!).gravity, "1.06");
  await client.deleteHydrometerLog("log/1", "device/1");
  assert.equal(requests[1].method, "DELETE");
});
test("range deletion preserves its exact reviewed bounds", async () => {
  const client = createMeadToolsApiClient({ baseUrl: "https://meadtools.test", fetch: async (url, init) => {
    const parsed = new URL(url);
    assert.equal(init.method, "DELETE");
    assert.equal(parsed.searchParams.get("start_date"), "2026-11-01T00:00:00Z");
    assert.equal(parsed.searchParams.get("end_date"), "2026-11-27T00:00:00Z");
    return { ok: true, status: 200, json: async () => ({ message: "Deleted" }) };
  }});
  await client.deleteHydrometerLogsInRange({ deviceId: "device", startDate: "2026-11-01T00:00:00Z", endDate: "2026-11-27T00:00:00Z" });
});
