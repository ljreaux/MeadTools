import assert from "node:assert/strict";
import test from "node:test";

import { getGoogleIosUrlScheme } from "../app.config";

test("preview builds without Google OAuth use an inert native URL scheme", () => {
  assert.equal(
    getGoogleIosUrlScheme({ buildProfile: "preview" }),
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
