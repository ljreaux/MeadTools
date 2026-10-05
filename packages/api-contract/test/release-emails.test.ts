import assert from "node:assert/strict";
import test from "node:test";
import {
  releaseEmailPreferencesUpdateBodySchema,
  releaseEmailUnsubscribeRequestBodySchema,
} from "../src/zod/release-emails";

test("product-update consent requires one explicit boolean", () => {
  const allOff = { optedIn: false };
  assert.deepEqual(
    releaseEmailPreferencesUpdateBodySchema.parse(allOff),
    allOff,
  );
  assert.equal(
    releaseEmailPreferencesUpdateBodySchema.safeParse({ optedIn: "yes" })
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

test("unsubscribe accepts only a signed account token", () => {
  assert.equal(
    releaseEmailUnsubscribeRequestBodySchema.safeParse({
      token: `7.${"a".repeat(64)}`,
    }).success,
    true,
  );
  assert.equal(
    releaseEmailUnsubscribeRequestBodySchema.safeParse({
      token: `7.${"a".repeat(63)}`,
    }).success,
    false,
  );
  assert.equal(
    releaseEmailUnsubscribeRequestBodySchema.safeParse({
      token: `7.${"a".repeat(64)}`,
      product: "web",
    }).success,
    false,
  );
});
