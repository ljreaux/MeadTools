import assert from "node:assert/strict";
import test from "node:test";
import { releaseEmailPreferencesUpdateBodySchema } from "../src/zod/release-emails";

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
