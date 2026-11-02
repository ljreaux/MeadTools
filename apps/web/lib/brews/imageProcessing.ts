import sharp from "sharp";
import {
  BREW_IMAGE_LIMITS as limits,
  BrewImageError,
} from "@meadtools/brew-domain/images";

export async function normalizeBrewImage(bytes: Buffer, declaredType: string) {
  if (!bytes.length || bytes.length > limits.uploadBytes)
    throw new BrewImageError("IMAGE_TOO_LARGE");
  try {
    const options = {
      limitInputPixels: limits.maxPixels,
      failOn: "warning" as const,
    };
    const metadata = await sharp(bytes, { ...options, limitInputPixels: false }).metadata();
    if ((metadata.width ?? 0) * (metadata.height ?? 0) > limits.maxPixels) {
      throw new BrewImageError("IMAGE_TOO_LARGE");
    }
    const types: Record<string, string> = {
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    if (
      !metadata.format ||
      types[metadata.format] !== declaredType ||
      (metadata.pages ?? 1) > 1
    ) {
      throw new BrewImageError("INVALID_IMAGE");
    }
    // Sharp removes EXIF/GPS by default. rotate() applies orientation before removing it.
    async function encode(edge: number, maxBytes: number) {
      for (const quality of [80, 65, 50, 35]) {
        const output = await sharp(bytes, options)
          .rotate()
          .resize({
            width: edge,
            height: edge,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality })
          .toBuffer({ resolveWithObject: true });
        if (output.data.length <= maxBytes) return output;
      }
      // Very noisy images can still exceed the cap; reduce dimensions as a final fallback.
      const output = await sharp(bytes, options)
        .rotate()
        .resize({
          width: Math.floor(edge / 2),
          height: Math.floor(edge / 2),
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 35 })
        .toBuffer({ resolveWithObject: true });
      if (output.data.length > maxBytes)
        throw new BrewImageError("IMAGE_TOO_LARGE");
      return output;
    }
    const image = await encode(limits.displayEdge, limits.displayBytes);
    const thumbnail = await encode(limits.thumbnailEdge, limits.thumbnailBytes);
    return {
      image: image.data,
      thumbnail: thumbnail.data,
      width: image.info.width,
      height: image.info.height,
    };
  } catch (error) {
    if (error instanceof BrewImageError) throw error;
    throw new BrewImageError("INVALID_IMAGE");
  }
}
