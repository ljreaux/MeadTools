import assert from "node:assert/strict";
import test from "node:test";

import {
  availableLocales,
  defaultLocale,
  i18nConfig,
  supportedLocales,
  translationNamespaces,
} from "../src/index";
import { loadTranslationResource } from "../src/resources";

test("locale configuration preserves the web baseline", () => {
  assert.deepEqual(supportedLocales, ["en", "de"]);
  assert.equal(defaultLocale, "en");
  assert.deepEqual(i18nConfig, {
    locales: ["en", "de"],
    defaultLocale: "en",
  });
});

test("every generated locale and namespace can be loaded", async () => {
  for (const locale of availableLocales) {
    for (const namespace of translationNamespaces) {
      const resource = await loadTranslationResource(locale, namespace);
      assert.equal(typeof resource, "object");
      assert.ok(Object.keys(resource).length > 0);
    }
  }
});

test("unknown resources fail explicitly", async () => {
  await assert.rejects(
    loadTranslationResource("fr", "default"),
    /No translation resource exists/,
  );
  await assert.rejects(
    loadTranslationResource("en", "missing"),
    /No translation resource exists/,
  );
});
