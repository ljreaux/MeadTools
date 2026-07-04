import assert from "node:assert/strict";
import test from "node:test";

import { resolveApiBaseUrl } from "../src/config/api";

test("uses the production API when no override is configured", () => {
  assert.equal(resolveApiBaseUrl(""), "https://meadtools.com");
});

test("normalizes a configured API base URL", () => {
  assert.equal(
    resolveApiBaseUrl(" https://preview.example.com/api/// "),
    "https://preview.example.com/api"
  );
});

test("maps localhost to the Android emulator host", () => {
  assert.equal(
    resolveApiBaseUrl("http://localhost:3000", "android"),
    "http://10.0.2.2:3000"
  );
  assert.equal(
    resolveApiBaseUrl("http://localhost:3000", "ios"),
    "http://localhost:3000"
  );
});

test("rejects non-HTTP API URLs", () => {
  assert.throws(
    () => resolveApiBaseUrl("file:///tmp/meadtools"),
    /must use HTTP or HTTPS/
  );
});
