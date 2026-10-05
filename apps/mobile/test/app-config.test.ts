import assert from "node:assert/strict";
import test from "node:test";

import { getGoogleIosUrlScheme } from "../app.config";

test("preview and simulator development can load without local Google OAuth", () => {
  assert.equal(
    getGoogleIosUrlScheme({ buildProfile: "preview" }),
    "com.googleusercontent.apps.000000000000-ci"
  );
  assert.equal(
    getGoogleIosUrlScheme({ buildProfile: "development-simulator" }),
    "com.googleusercontent.apps.000000000000-ci"
  );
});

test("configured Google sign-in keeps its own native URL scheme", () => {
  assert.equal(
    getGoogleIosUrlScheme({
      clientId: "123-abc.apps.googleusercontent.com",
      buildProfile: "preview"
    }),
    "com.googleusercontent.apps.123-abc"
  );
});

test("missing or invalid production Google configuration still fails", () => {
  assert.throws(
    () => getGoogleIosUrlScheme({ buildProfile: "production" }),
    /EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID/
  );
  assert.throws(
    () =>
      getGoogleIosUrlScheme({
        clientId: "invalid",
        buildProfile: "preview"
      }),
    /EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID/
  );
});
