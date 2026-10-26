import { z } from "zod";

export const brewImagesPathParamsSchema = z.object({
  brew_id: z.string().uuid(),
});
export const brewImagePathParamsSchema = brewImagesPathParamsSchema.extend({
  image_id: z.string().uuid(),
});
export const brewImageResponseSchema = z.object({
  id: z.string().uuid(),
  caption: z.string().max(500),
  entry_id: z.string().uuid().nullable(),
  entry_title: z.string().nullable(),
  entry_datetime: z.string().datetime().nullable(),
  entry_hidden: z.boolean(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  size_bytes: z.number().int().positive(),
  created_at: z.string().datetime(),
});
export const brewImagesResponseSchema = z.object({
  images: z.array(brewImageResponseSchema),
  can_upload: z.boolean(),
  used_bytes: z.number().int().nonnegative(),
  allowance_bytes: z.number().int().positive(),
});
export const publicBrewImagesResponseSchema = z.object({
  images: z.array(brewImageResponseSchema),
});
export const createBrewImageRequestBodySchema = z
  .object({
    operation_id: z.string().uuid(),
    entry_id: z.string().uuid().optional(),
    caption: z.string().trim().max(500).default(""),
    content_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
    base64: z
      .string()
      .min(4)
      .max(4_194_304)
      .regex(
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
      ),
  })
  .strict();
export const updateBrewImageRequestBodySchema = z
  .object({ caption: z.string().trim().max(500) })
  .strict();
export const brewImageMutationResponseSchema = z.object({
  image: brewImageResponseSchema,
});
export const brewImageRemovedResponseSchema = z.object({
  removed: z.literal(true),
});
export const brewImageAccessResponseSchema = z.object({
  url: z.string().url(),
  expires_at: z.string().datetime(),
});
export const brewImagesQueryParamsSchema = z.object({
  public: z.enum(["true", "false"]).optional(),
});
export const brewImageAccessQueryParamsSchema =
  brewImagesQueryParamsSchema.extend({
    variant: z.enum(["image", "thumbnail"]).default("image"),
  });
export const brewImageErrorResponseSchema = z.object({
  error: z.string(),
  code: z.enum([
    "INVALID_IMAGE",
    "IMAGE_TOO_LARGE",
    "QUOTA_EXCEEDED",
    "BREW_IMAGE_LIMIT",
    "PREMIUM_REQUIRED",
    "NOT_FOUND",
    "UPLOAD_IN_PROGRESS",
    "OPERATION_CONFLICT",
    "UPLOAD_FAILED",
    "STORAGE_UNAVAILABLE",
    "RATE_LIMITED",
  ]),
});
