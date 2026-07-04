import assert from "node:assert/strict";
import test from "node:test";

import { isGoogleAuthConfigured } from "../src/config/google-auth";

test("enables Google authentication only for a configured platform client", () => {
  const clientIds = {
    iosClientId: "ios-client",
    webClientId: "web-client"
  };

  assert.equal(isGoogleAuthConfigured("ios", clientIds), true);
  assert.equal(isGoogleAuthConfigured("android", clientIds), false);
  assert.equal(
    isGoogleAuthConfigured("android", {
      androidClientId: "android-client",
      webClientId: "web-client"
    }),
    true
  );
  assert.equal(isGoogleAuthConfigured("web", clientIds), false);
});
