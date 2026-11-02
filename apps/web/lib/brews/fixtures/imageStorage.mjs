import assert from "node:assert/strict";
const { createR2ImageStorage, isBrewImageStorageConfigured } =
  await import("../imageStorage.ts");
assert.equal(isBrewImageStorageConfigured(), false);
assert.throws(() => createR2ImageStorage(), { message: "STORAGE_UNAVAILABLE" });
Object.assign(process.env, {
  R2_ACCOUNT_ID: "fixture-account",
  R2_ACCESS_KEY_ID: "fixture-key",
  R2_SECRET_ACCESS_KEY: "fixture-secret",
  R2_BUCKET: "meadtools-brew-images-nonproduction",
});
assert.equal(isBrewImageStorageConfigured(), true);
const key = "development/brews/fixture/image.webp";
const url = new URL(await createR2ImageStorage().signedRead(key));
assert.equal(url.searchParams.get("X-Amz-Expires"), "60");
assert.equal(
  url.searchParams.get("response-cache-control"),
  "private, no-store",
);
assert.equal(url.searchParams.get("response-content-type"), "image/webp");
await assert.rejects(
  createR2ImageStorage().signedRead("production/brews/foreign/image.webp"),
  { message: "STORAGE_UNAVAILABLE" },
);
process.env.VERCEL_ENV = "preview";
await assert.rejects(createR2ImageStorage().signedRead(key), {
  message: "STORAGE_UNAVAILABLE",
});
process.env.VERCEL_ENV = "production";
assert.throws(() => createR2ImageStorage(), { message: "STORAGE_UNAVAILABLE" });
process.env.R2_BUCKET = "meadtools-brew-images-production";
const productionUrl = new URL(
  await createR2ImageStorage().signedRead(
    "production/brews/fixture/image.webp",
  ),
);
assert.ok(
  productionUrl.hostname.startsWith("meadtools-brew-images-production."),
);
// No network operations are performed; signing uses only these dummy credentials.
