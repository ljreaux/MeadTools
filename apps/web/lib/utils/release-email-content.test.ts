import assert from "node:assert/strict";
import test from "node:test";
import { renderReleaseEmail } from "../release-email-content";

test("release email contains one shipped product, archive link, and direct unsubscribe", () => {
  const result = renderReleaseEmail({
    date: "2026-11-02",
    product: "web",
    entry: {
      title: "November 2026",
      products: {
        web: { items: ["A Web feature."] },
        mobile: { items: ["A Mobile feature."] },
      },
    },
    baseUrl: "https://meadtools.com",
    postalAddress: "PO Box 123, Somewhere, IL 60000",
    unsubscribeToken: "a".repeat(64),
  });
  assert.match(result.text, /A Web feature/);
  assert.doesNotMatch(result.text, /A Mobile feature/);
  assert.match(result.text, /release-notes\/2026-11-02/);
  assert.match(result.text, /unsubscribe\?token=a{64}&product=web/);
});
