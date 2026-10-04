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
