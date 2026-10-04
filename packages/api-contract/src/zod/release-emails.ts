import { z } from "zod";

export const releaseEmailPreferencesUpdateBodySchema = z
  .object({
    optedIn: z.boolean(),
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
    token: z.string().regex(/^[1-9]\d*\.[a-f0-9]{64}$/),
  })
  .strict();

export const releaseEmailUnsubscribeResponseSchema = z.object({
  unsubscribed: z.literal(true),
});
