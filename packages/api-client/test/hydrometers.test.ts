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
