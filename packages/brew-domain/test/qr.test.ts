import assert from "node:assert/strict";
import test from "node:test";
import sharp, { type OutputInfo } from "sharp";
import jsQR from "jsqr";
import { brewQrUrl, brewLinkDestination } from "../src/links";
import { generateOwnedBrewQr } from "../src/qr";

test("printed URLs use the configured public origin and contain only the brew ID", () => {
  assert.equal(brewQrUrl("11111111-1111-4111-8111-111111111111", "https://meadtools.com"), "https://meadtools.com/brews/11111111-1111-4111-8111-111111111111");
  for (const invalid of ["", "..", "../secret", "x?token=secret", "x#part", "https://elsewhere.com", "x".repeat(129)]) {
    assert.throws(() => brewQrUrl(invalid, "https://meadtools.com"));
  }
});

test("public base URL is configurable, normalizes a trailing slash, and rejects credentials or extra URL content", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(brewQrUrl(id, "https://configured.meadtools.com/"), `https://configured.meadtools.com/brews/${id}`);
  assert.equal(brewQrUrl(id, "http://localhost:3000"), `http://localhost:3000/brews/${id}`);
  for (const invalid of ["", "javascript:alert(1)", "https://user:password@example.com", "https://example.com/path", "https://example.com?token=secret", "https://example.com#fragment"]) {
    assert.throws(() => brewQrUrl(id, invalid));
  }
});

test("destinations preserve locale and use normal owner access unless public", () => {
  assert.equal(brewLinkDestination("11111111-1111-4111-8111-111111111111", 23), "/recipes/23/brews/11111111-1111-4111-8111-111111111111");
  assert.equal(brewLinkDestination("11111111-1111-4111-8111-111111111111", 23, "de"), "/de/recipes/23/brews/11111111-1111-4111-8111-111111111111");
  assert.equal(brewLinkDestination("11111111-1111-4111-8111-111111111111", null), "/account/brews/11111111-1111-4111-8111-111111111111");
  assert.equal(brewLinkDestination("11111111-1111-4111-8111-111111111111", null, "de"), "/de/account/brews/11111111-1111-4111-8111-111111111111");
});

test("downloaded SVG decodes independently at representative print raster sizes", async () => {
  const result = await generateOwnedBrewQr("11111111-1111-4111-8111-111111111111", {
    publicBaseUrl: "https://meadtools.com", ownsBrew: async () => true, premiumEnabled: async () => true,
  });
  assert.ok("svg" in result);
  assert.equal(result.filename, "meadtools-brew-11111111-1111-4111-8111-111111111111-qr.svg");
  assert.ok(!result.svg.includes("<script"));
  assert.ok(!result.svg.includes("https://")); // URL is encoded geometry, never an external resource.
  for (const width of [354, 512, 1024]) { // 30 mm at 300 dpi, plus larger labels.
    const raster: { data: Buffer; info: OutputInfo } = await sharp(Buffer.from(result.svg)).resize(width, width).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(raster.data), raster.info.width, raster.info.height);
    assert.equal(decoded?.data, "https://meadtools.com/brews/11111111-1111-4111-8111-111111111111");
    // The quiet zone stays white in the actual rasterized download.
    assert.deepEqual([...raster.data.subarray(0, 4)], [255, 255, 255, 255]);
  }
});

test("non-owner and deleted brews return the same non-disclosing error", async () => {
  let premiumChecks = 0;
  const result = await generateOwnedBrewQr("11111111-1111-4111-8111-111111111111", {
    publicBaseUrl: "https://meadtools.com", ownsBrew: async () => false,
    premiumEnabled: async () => { premiumChecks++; return true; },
  });
  assert.deepEqual(result, { error: "unavailable" });
  assert.equal(premiumChecks, 0);
});

test("each generation rechecks entitlement, including download after expiry or restriction", async () => {
  let enabled = true;
  const access = { publicBaseUrl: "https://meadtools.com", ownsBrew: async () => true, premiumEnabled: async () => enabled };
  assert.ok("svg" in await generateOwnedBrewQr("11111111-1111-4111-8111-111111111111", access));
  enabled = false;
  assert.deepEqual(await generateOwnedBrewQr("11111111-1111-4111-8111-111111111111", access), { error: "premiumRequired" });
  // Printed destinations are independent of entitlement and remain stable.
  assert.equal(brewQrUrl("11111111-1111-4111-8111-111111111111", "https://meadtools.com"), "https://meadtools.com/brews/11111111-1111-4111-8111-111111111111");
  assert.equal(brewLinkDestination("11111111-1111-4111-8111-111111111111", 23), "/recipes/23/brews/11111111-1111-4111-8111-111111111111");
});

test("invalid IDs are rejected before any access or database call", async () => {
  const unexpected = async () => { throw new Error("must not be called"); };
  assert.deepEqual(await generateOwnedBrewQr("../private", {
    publicBaseUrl: "https://meadtools.com", ownsBrew: unexpected, premiumEnabled: unexpected,
  }), { error: "unavailable" });
});
