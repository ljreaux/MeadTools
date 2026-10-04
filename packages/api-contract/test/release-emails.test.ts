import assert from "node:assert/strict";
import test from "node:test";
import {
  releaseEmailPreferencesUpdateBodySchema,
  releaseEmailUnsubscribeRequestBodySchema,
} from "../src/zod/release-emails";

test("release email consent requires an explicit boolean for each product", () => {
  const allOff = { web: false, mobile: false, chat: false, api: false };
  assert.deepEqual(
    releaseEmailPreferencesUpdateBodySchema.parse(allOff),
    allOff,
  );
  assert.equal(
    releaseEmailPreferencesUpdateBodySchema.safeParse({ ...allOff, web: "yes" })
      .success,
    false,
  );
  assert.equal(
    releaseEmailPreferencesUpdateBodySchema.safeParse({ web: true }).success,
    false,
  );
  assert.equal(
    releaseEmailPreferencesUpdateBodySchema.safeParse({
      ...allOff,
      brewAlerts: true,
    }).success,
    false,
  );
});

test("unsubscribe accepts only an opaque token and one release product", () => {
  assert.equal(
    releaseEmailUnsubscribeRequestBodySchema.safeParse({
      token: "a".repeat(64),
      product: "web",
    }).success,
    true,
  );
  assert.equal(
    releaseEmailUnsubscribeRequestBodySchema.safeParse({
      token: "a".repeat(63),
      product: "web",
    }).success,
    false,
  );
  assert.equal(
    releaseEmailUnsubscribeRequestBodySchema.safeParse({
      token: "a".repeat(64),
      product: "brewAlerts",
    }).success,
    false,
  );
});
