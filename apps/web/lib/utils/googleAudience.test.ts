import assert from "node:assert/strict";
import test from "node:test";

import {
  getAllowedGoogleAudiences,
  isAllowedGoogleAudience
} from "@/lib/auth/google-audience";

test("accepts only configured web and native Google OAuth audiences", () => {
  const audiences = getAllowedGoogleAudiences({
    GOOGLE_CLIENT_ID: "web-client",
    GOOGLE_IOS_CLIENT_ID: "ios-client",
    GOOGLE_ANDROID_CLIENT_ID: "android-client"
  });

  assert.deepEqual(audiences, [
    "web-client",
    "ios-client",
    "android-client"
  ]);
  assert.equal(isAllowedGoogleAudience("ios-client", audiences), true);
  assert.equal(isAllowedGoogleAudience("unknown-client", audiences), false);
});

test("drops missing and duplicate Google OAuth audiences", () => {
  assert.deepEqual(
    getAllowedGoogleAudiences({
      GOOGLE_CLIENT_ID: "shared-client",
      GOOGLE_IOS_CLIENT_ID: "shared-client"
    }),
    ["shared-client"]
  );
});
