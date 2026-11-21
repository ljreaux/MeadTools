import assert from "node:assert/strict";
import test from "node:test";

import { MeadToolsApiError, MeadToolsContractError } from "@meadtools/api-client";

import { isConnectionError } from "../src/api/errors";

class FetchError extends Error {}

test("transport failures count as connection errors; server answers do not", () => {
  assert.equal(isConnectionError(new FetchError("Could not connect to the server.")), true);
  assert.equal(isConnectionError(new TypeError("Network request failed")), true);
  assert.equal(isConnectionError(new MeadToolsApiError(500, { error: "boom" })), false);
  assert.equal(isConnectionError(new MeadToolsApiError(401, undefined)), false);
  assert.equal(isConnectionError(new MeadToolsContractError("bad shape", {})), false);
  assert.equal(isConnectionError(undefined), false);
});
