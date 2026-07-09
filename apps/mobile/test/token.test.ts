import assert from "node:assert/strict";
import test from "node:test";

import { isAccessTokenExpired } from "../src/auth/token";

function tokenWithExpiration(exp: number) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `header.${payload}.signature`;
}

test("recognizes an access token that remains valid", () => {
  assert.equal(
    isAccessTokenExpired(tokenWithExpiration(3_000), 1_000_000),
    false
  );
});

test("recognizes expired and malformed access tokens", () => {
  assert.equal(
    isAccessTokenExpired(tokenWithExpiration(1_000), 1_000_000),
    true
  );
  assert.equal(isAccessTokenExpired("not-a-jwt", 1_000_000), true);
});
