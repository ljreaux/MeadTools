import assert from "node:assert/strict";
import test from "node:test";

import { refreshTokenBelongsToUser } from "@/lib/auth/refresh-token";

test("requires a refresh token to belong to the requested user", () => {
  assert.equal(refreshTokenBelongsToUser({ id: 42 }, 42), true);
  assert.equal(refreshTokenBelongsToUser({ id: 7 }, 42), false);
  assert.equal(refreshTokenBelongsToUser("unexpected-token-payload", 42), false);
});
