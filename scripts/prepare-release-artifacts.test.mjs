import assert from "node:assert/strict";
import { test } from "node:test";
import { renderReleaseArtifacts } from "./prepare-release-artifacts.mjs";

test("drafts email only for shipped products while preserving Mobile preview status in public notes", () => {
  const entry = {
    title: "October 2026",
    summary: "A verified update.",
    products: {
      web: { items: ["A Web improvement."] },
      mobilePreview: {
        items: ["A Mobile preview feature; no production release."],
      },
    },
  };
  const artifacts = renderReleaseArtifacts("2026-10-04", entry);
  assert.match(
    artifacts.github,
    /Mobile preview progress — no production Mobile release/,
  );
  assert.deepEqual(Object.keys(artifacts.emails), ["web"]);
  assert.match(artifacts.emails.web.text, /\{\{unsubscribe_url\}\}/);
  assert.equal(artifacts.tag, "release-2026-10-04");
});

test("a Mobile-preview-only or empty month produces no public artifacts", () => {
  assert.throws(
    () =>
      renderReleaseArtifacts("2026-10-04", {
        title: "October 2026",
        summary: "Preview only.",
        products: { mobilePreview: { items: ["In testing."] } },
      }),
    /No shipped product/,
  );
});
