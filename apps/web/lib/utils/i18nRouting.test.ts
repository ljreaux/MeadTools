import assert from "node:assert/strict";
import test from "node:test";
import { getLocalizedPathname } from "./i18nRouting";

test("removes the locale prefix when switching to the default locale", () => {
  assert.equal(getLocalizedPathname("/de/account/brews", "en"), "/account/brews");
  assert.equal(getLocalizedPathname("/de", "en"), "/");
});

test("adds or replaces the locale prefix for a non-default locale", () => {
  assert.equal(getLocalizedPathname("/account/brews", "de"), "/de/account/brews");
  assert.equal(getLocalizedPathname("/en/account", "de"), "/de/account");
  assert.equal(getLocalizedPathname("/", "de"), "/de");
});

test("does not treat a partial first segment match as a locale", () => {
  assert.equal(getLocalizedPathname("/design", "de"), "/de/design");
});
