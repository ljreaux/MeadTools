import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const requireFromMobile = createRequire(import.meta.url);

test("hoisted expo-constants resolves the app's Expo config", () => {
  const constantsPackage = requireFromMobile.resolve("expo-constants/package.json");
  const requireFromConstants = createRequire(constantsPackage);

  assert.equal(
    requireFromConstants.resolve("expo/config"),
    requireFromMobile.resolve("expo/config")
  );
});

test("hoisted router server resolves the app's Expo Router", () => {
  const routerServerPackage = requireFromMobile.resolve(
    "@expo/router-server/package.json"
  );
  const requireFromRouterServer = createRequire(routerServerPackage);

  assert.equal(
    requireFromRouterServer.resolve("expo-router/build/utils/url"),
    requireFromMobile.resolve("expo-router/build/utils/url")
  );
});
