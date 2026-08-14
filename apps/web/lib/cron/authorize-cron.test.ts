import assert from "node:assert/strict";
import test from "node:test";
import { isAuthorizedCronRequest } from "./authorize-cron";

test("cron authorization fails closed when its secret is absent or blank", () => {
  assert.equal(isAuthorizedCronRequest("Bearer undefined", undefined), false);
  assert.equal(isAuthorizedCronRequest("Bearer undefined", ""), false);
  assert.equal(isAuthorizedCronRequest("Bearer undefined", "   "), false);
});

test("cron authorization accepts only the configured bearer secret", () => {
  assert.equal(isAuthorizedCronRequest(null, "cron-secret"), false);
  assert.equal(isAuthorizedCronRequest("Bearer wrong", "cron-secret"), false);
  assert.equal(isAuthorizedCronRequest("Bearer cron-secret", "cron-secret"), true);
});
