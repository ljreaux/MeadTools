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
