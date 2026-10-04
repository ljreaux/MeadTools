import { z } from "zod";

export const releaseEmailPreferencesUpdateBodySchema = z
  .object({
    web: z.boolean(),
    mobile: z.boolean(),
    chat: z.boolean(),
    api: z.boolean(),
  })
  .strict();

export const releaseEmailPreferencesResponseSchema =
  releaseEmailPreferencesUpdateBodySchema.extend({
    prompted: z.boolean(),
  });

export const releaseEmailPreferencesErrorResponseSchema = z.object({
  error: z.string(),
});

export const releaseEmailUnsubscribeRequestBodySchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    product: z.enum(["web", "mobile", "chat", "api"]),
  })
  .strict();

export const releaseEmailUnsubscribeResponseSchema = z.object({
  unsubscribed: z.literal(true),
});

const releaseEmailProductSchema = z.enum(["web", "mobile", "chat", "api"]);

export const adminReleaseEmailSelectionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  product: releaseEmailProductSchema,
});

export const adminReleaseEmailRequestBodySchema = adminReleaseEmailSelectionSchema.extend({
  action: z.enum(["prepare", "send"]),
  confirmation: z.string(),
}).strict();

export const adminReleaseEmailOverviewResponseSchema = z.object({
  available: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string(),
    products: z.array(releaseEmailProductSchema),
  })),
  counts: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    product: releaseEmailProductSchema,
    status: z.enum(["PENDING", "SENDING", "SENT", "FAILED", "SKIPPED"]),
    count: z.number().int().nonnegative(),
  })),
  sent: z.number().int().nonnegative().optional(),
  failed: z.number().int().nonnegative().optional(),
  skipped: z.number().int().nonnegative().optional(),
});
