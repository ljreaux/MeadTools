import assert from "node:assert/strict";
import test from "node:test";

import { MeadToolsApiError, MeadToolsContractError } from "@meadtools/api-client";

import { ConnectionError, isConnectionError } from "../src/api/errors";

class FetchError extends Error {}

test("only transport failures wrapped by the Mobile fetch count as connection errors", () => {
  const wrapped = new ConnectionError(new FetchError("fetch failed: Could not connect to the server."));
  assert.equal(isConnectionError(wrapped), true);
  assert.equal(wrapped instanceof TypeError, true);
  assert.equal(wrapped.message, "fetch failed: Could not connect to the server.");

  assert.equal(isConnectionError(new FetchError("fetch failed")), false);
  assert.equal(isConnectionError(new TypeError("undefined is not a function")), false);
  assert.equal(isConnectionError(new Error("Unable to resolve module")), false);
  assert.equal(isConnectionError(new MeadToolsApiError(500, { error: "boom" })), false);
  assert.equal(isConnectionError(new MeadToolsContractError("bad shape", {})), false);
  assert.equal(isConnectionError(undefined), false);
});
