import assert from "node:assert/strict";
import test from "node:test";

import { createSessionHolder } from "../src/auth/session-holder";

const session = {
  accessToken: "access",
  email: "brewer@example.com",
  id: 7,
  refreshToken: "refresh",
  role: "user"
};

test("session holder starts empty and returns the latest session", () => {
  const holder = createSessionHolder();
  const readToken = () => holder.get()?.accessToken;

  assert.equal(holder.get(), null);
  assert.equal(readToken(), undefined);

  holder.set(session);
  assert.equal(readToken(), "access");

  holder.set({ ...session, accessToken: "refreshed" });
  assert.equal(readToken(), "refreshed");

  holder.set(null);
  assert.equal(readToken(), undefined);
});

test("separate holders never share a session", () => {
  const first = createSessionHolder();
  const second = createSessionHolder();

  first.set(session);
  assert.equal(second.get(), null);
});
