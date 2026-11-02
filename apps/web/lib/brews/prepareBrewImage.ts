import {
  BREW_IMAGE_LIMITS as limits,
  BrewImageError,
} from "@meadtools/brew-domain/images";

/** Browser-only transport optimization; the server independently validates every byte. */
export async function prepareBrewImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new BrewImageError("INVALID_IMAGE");
  if (file.size > limits.originalBytes)
    throw new BrewImageError("IMAGE_TOO_LARGE");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > limits.maxPixels)
      throw new BrewImageError("IMAGE_TOO_LARGE");
    const ratio = Math.min(
      1,
      limits.displayEdge / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new BrewImageError("INVALID_IMAGE");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.5]) {
      const data = canvas.toDataURL("image/webp", quality);
      const comma = data.indexOf(",");
      const contentType = data.slice(5, data.indexOf(";"));
      const base64 = data.slice(comma + 1);
      if (!["image/webp", "image/png"].includes(contentType))
        throw new BrewImageError("INVALID_IMAGE");
      if (base64.length <= Math.ceil(limits.uploadBytes / 3) * 4)
        return {
          content_type: contentType as "image/webp" | "image/png",
          base64,
        };
    }
    throw new BrewImageError("IMAGE_TOO_LARGE");
  } finally {
    bitmap.close();
  }
}
