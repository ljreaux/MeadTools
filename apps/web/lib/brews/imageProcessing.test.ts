import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { normalizeBrewImage } from "./imageProcessing";

test("normalization strips metadata, applies orientation and creates bounded WebP variants", async () => {
  const input = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: "red" },
  })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: {
        IFD0: { Artist: "Private author" },
        IFD3: { GPSLatitudeRef: "N" },
      },
    })
    .toBuffer();
  const output = await normalizeBrewImage(input, "image/jpeg");
  assert.equal(output.width, 800);
  assert.equal(output.height, 1600);
  for (const bytes of [output.image, output.thumbnail]) {
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.orientation, undefined);
  }
  assert.ok(output.image.length <= 1024 * 1024);
  assert.ok(output.thumbnail.length <= 64 * 1024);
  assert.ok(
    Math.max(
      (await sharp(output.thumbnail).metadata()).width!,
      (await sharp(output.thumbnail).metadata()).height!,
    ) <= 320,
  );
});
test("actual content, declared type, corruption, animation, pixel and byte limits are checked", async () => {
  const png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await assert.rejects(normalizeBrewImage(png, "image/jpeg"), {
    message: "INVALID_IMAGE",
  });
  await assert.rejects(
    normalizeBrewImage(Buffer.from("<svg></svg>"), "image/png"),
    { message: "INVALID_IMAGE" },
  );
  await assert.rejects(normalizeBrewImage(png.subarray(0, 20), "image/png"), {
    message: "INVALID_IMAGE",
  });
  await assert.rejects(
    normalizeBrewImage(Buffer.alloc(3 * 1024 * 1024 + 1), "image/png"),
    { message: "IMAGE_TOO_LARGE" },
  );
  const huge = await sharp({
    create: { width: 7000, height: 6000, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await assert.rejects(normalizeBrewImage(huge, "image/png"), {
    message: "IMAGE_TOO_LARGE",
  });
  const frames = Buffer.concat([
    Buffer.alloc(4 * 4 * 3, 255),
    Buffer.alloc(4 * 4 * 3, 0),
  ]);
  const animated = await sharp(frames, {
    raw: { width: 4, height: 8, channels: 3, pageHeight: 4 },
  })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  await assert.rejects(normalizeBrewImage(animated, "image/webp"), {
    message: "INVALID_IMAGE",
  });
});
