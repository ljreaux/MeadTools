import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composeProductUpdateEmail,
  eligibleProductUpdateRelease,
} from "@/lib/product-update-email";
import {
  productUpdateUnsubscribeToken,
  userIdFromProductUpdateToken,
} from "@/lib/release-email-token";

const release = (date: string, products: Record<string, { items: string[] }>) => ({
  date,
  content: { title: "October release", summary: "Verified changes.", products },
});

test("only a recent shipped release is eligible; Mobile preview alone is not", () => {
  const now = new Date("2026-10-05T16:00:00Z");
  const releases = [
    release("2026-10-06", { web: { items: ["Future."] } }),
    release("2026-10-05", { mobilePreview: { items: ["Preview."] } }),
    release("2026-10-04", { web: { items: ["Shipped."] } }),
    release("2026-09-20", { web: { items: ["Old."] } }),
  ];
  assert.equal(eligibleProductUpdateRelease(releases, now)?.date, "2026-10-04");
  assert.equal(eligibleProductUpdateRelease(releases.slice(0, 2), now), null);
  assert.equal(eligibleProductUpdateRelease(releases.slice(3), now), null);
});

test("one product update separates shipped products and omits preview-only progress", () => {
  const prior = process.env.NEXTAUTH_SECRET;
  process.env.NEXTAUTH_SECRET = "test-only-signing-key";
  try {
    const message = composeProductUpdateEmail(
      release("2026-10-05", {
        web: { items: ["Web shipped."] },
        mobilePreview: { items: ["Mobile still in preview."] },
        api: { items: ["API shipped."] },
      }),
      7,
    );
    assert.match(message.text, /Web:\n- Web shipped/);
    assert.match(message.text, /API and integrations:\n- API shipped/);
    assert.doesNotMatch(message.text, /Mobile still in preview/);
    assert.match(message.text, /release-notes\/2026-10-05/);
    const token = productUpdateUnsubscribeToken(7);
    assert.equal(userIdFromProductUpdateToken(token), 7);
    assert.equal(userIdFromProductUpdateToken(`8.${token.split(".")[1]}`), null);
  } finally {
    if (prior === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = prior;
  }
});
