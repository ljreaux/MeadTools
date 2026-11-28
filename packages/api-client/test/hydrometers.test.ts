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

const brew = { id: "brew/1", name: "Test brew", start_date: "2026-11-27T00:00:00Z", end_date: null, user_id: 1, latest_gravity: null, recipe_id: null, requested_email_alerts: false, sb_alert_sent: false, fg_alert_sent: false, stage: "PLANNED", batch_number: null, current_volume_liters: null, recipe_snapshot: null };
test("lifecycle methods preserve start, rename, unlink and end endpoint semantics", async () => {
  const calls: Array<{ url: string; init: import("../src/index").ApiRequestInit }> = [];
  const client = createMeadToolsApiClient({ baseUrl: "https://meadtools.test", fetch: async (url, init) => {
    calls.push({ url, init });
    const payload = init.body ? JSON.parse(init.body) : {};
    return { ok: true, status: 200, json: async () => init.method === "GET" ? [brew] : payload.brew_name && init.method === "PATCH" ? { ...brew, name: payload.brew_name } : [brew, device] };
  }});
  assert.deepEqual(await client.listHydrometerBrews(), [brew]);
  await assert.rejects(client.startHydrometerBrew("device", "   "), MeadToolsContractError);
  await assert.rejects(client.renameHydrometerBrew("brew", " \t"), MeadToolsContractError);
  assert.equal(calls.length, 1);
  await client.startHydrometerBrew("device", " New brew ");
  assert.equal(JSON.parse(calls[1].init.body!).brew_name, "New brew");
  await client.renameHydrometerBrew("brew/1", " Renamed ");
  assert.deepEqual(JSON.parse(calls[2].init.body!), { brew_id: "brew/1", brew_name: "Renamed" });
  await client.unlinkHydrometerDevice("brew/1", "device");
  assert.equal(new URL(calls[3].url).pathname, "/api/brews");
  await client.endHydrometerBrew("brew/1", "device");
  assert.equal(new URL(calls[4].url).pathname, "/api/hydrometer/brew");
  assert.deepEqual(JSON.parse(calls[4].init.body!), { brew_id: "brew/1", device_id: "device" });
});
test("attachment and import never force reassignment or move another brew's historical logs", async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const client = createMeadToolsApiClient({ baseUrl: "https://meadtools.test", fetch: async (url, init) => {
    const body = JSON.parse(init.body!); calls.push({ url, body });
    return { ok: true, status: 200, json: async () => url.endsWith("attach-device") ? { message: "Device attached", device_id: "device", brew_id: "brew/1" } : { message: "Logs adopted", device_id: "device", brew_id: "brew/1", adopted_count: 2 } };
  }});
  await client.attachHydrometerDevice("brew/1", "device");
  await client.importUnassignedHydrometerLogs("brew/1", "device");
  assert.match(calls[0].url, /brew%2F1\/attach-device$/);
  assert.deepEqual(calls[0].body, { device_id: "device" });
  assert.deepEqual(calls[1].body, { device_id: "device" });
});
test("recipe and alert updates send only the intended branch, including false for opt-out", async () => {
  const bodies: unknown[] = [];
  const client = createMeadToolsApiClient({ baseUrl: "https://meadtools.test", fetch: async (_url, init) => {
    const body = JSON.parse(init.body!); bodies.push(body);
    return { ok: true, status: 200, json: async () => body.recipe_id ? { ...brew, recipe_id: body.recipe_id } : { message: "Updated" } };
  }});
  await client.linkHydrometerBrewRecipe("brew", 4);
  await client.setHydrometerBrewAlerts("brew", false);
  assert.deepEqual(bodies, [{ recipe_id: 4 }, { requested_email_alerts: false }]);
  await assert.rejects(client.linkHydrometerBrewRecipe("brew", 0), MeadToolsContractError);
  assert.equal(bodies.length, 2);
});

test("setup token methods use the existing account/token routes and redact malformed responses and HTTP errors", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  let response: unknown = { hydro_token: "setup-test-only", devices: [device] };
  let status = 200;
  const client = createMeadToolsApiClient({ baseUrl: "https://meadtools.test", fetch: async (url, init) => {
    calls.push({ url, method: init.method });
    return { ok: status === 200, status, json: async () => response };
  }});
  assert.equal(await client.getHydrometerSetupToken(), "setup-test-only");
  response = { token: "generated-test-only" };
  assert.equal(await client.generateHydrometerSetupToken(), "generated-test-only");
  assert.deepEqual(calls.map((call) => [new URL(call.url).pathname, call.method]), [["/api/hydrometer", "GET"], ["/api/hydrometer/token", "POST"]]);
  response = { hydro_token: "private-test-only", devices: "invalid" };
  await assert.rejects(client.getHydrometerSetupToken(), (error: unknown) => error instanceof MeadToolsContractError && error.value === undefined);
  response = { token: "private-test-only", unexpected: true }; status = 401;
  await assert.rejects(client.generateHydrometerSetupToken(), (error: unknown) => error instanceof MeadToolsApiError && error.status === 401 && error.body === undefined && !error.message.includes("private-test-only"));
  status = 200; response = { token: "" };
  await assert.rejects(client.generateHydrometerSetupToken(), MeadToolsContractError);
});
test("device calibration requires four finite coefficients and removal targets only the encoded device", async () => {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const coefficients = [1e-7, -0.003, 0.25, 1];
  const client = createMeadToolsApiClient({ baseUrl: "https://meadtools.test", fetch: async (url, init) => {
    calls.push({ url, ...init });
    return { ok: true, status: 200, json: async () => init.method === "PATCH" ? { ...device, coefficients } : { message: "Deleted" } };
  }});
  await assert.rejects(client.updateHydrometerCoefficients("device", []), MeadToolsContractError);
  await assert.rejects(client.updateHydrometerCoefficients("device", [0, Infinity, 0, 1]), MeadToolsContractError);
  assert.equal(calls.length, 0);
  assert.deepEqual((await client.updateHydrometerCoefficients("device/1", coefficients)).coefficients, coefficients);
  assert.match(calls[0].url, /device\/device%2F1$/);
  assert.deepEqual(JSON.parse(calls[0].body!), { coefficients });
  await client.deleteHydrometerDevice("device/1");
  assert.equal(calls[1].method, "DELETE");
  assert.equal(calls[1].url, calls[0].url);
});
