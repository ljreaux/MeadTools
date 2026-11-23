import assert from "node:assert/strict";
import test from "node:test";

import { getGoogleIosUrlScheme } from "../app.config";
import appJson from "../app.json";

test("Android back keeps working after the keyboard has been shown", () => {
  // With the legacy back key path (enableOnBackInvokedCallback="false"), Gboard
  // keeps the input connection of a text field after its screen is gone and
  // swallows every later back press. Predictive back routes back through the
  // app's own callback instead.
  assert.equal(appJson.expo.android.predictiveBackGestureEnabled, true);
});

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
