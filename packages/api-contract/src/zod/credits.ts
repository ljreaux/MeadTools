import { z } from "zod";

/** Whole prepaid credits; 1,000 credits have one US dollar of face value. */
export const creditBalanceResponseSchema = z.object({
  availableCredits: z.number().int(),
});

export const creditAccountErrorResponseSchema = z.object({
  error: z.string(),
  availableCredits: z.number().int().optional(),
  requiredCredits: z.number().int().optional(),
});

export const creditActivityQuerySchema = z.object({
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const creditActivityResponseSchema = z.object({
  availableCredits: z.number().int(),
  purchasesEnabled: z.boolean(),
  activities: z.array(
    z.object({
      operationId: z.string().uuid(),
      occurredAt: z.string().datetime(),
      creditsDelta: z.number().int(),
      kind: z.enum(["purchase", "grant", "usage", "refund", "adjustment"]),
      entryTypes: z.array(z.string()),
      paymentAmountCents: z.number().int().nullable(),
      paymentCurrency: z.string().length(3).nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export const createCreditCheckoutRequestBodySchema = z
  .object({
    packId: z.enum(["starter", "standard", "reserve"]),
  })
  .strict();

export const createCreditCheckoutResponseSchema = z.object({
  url: z.string().url(),
});

export const stripeWebhookReceiptResponseSchema = z.object({
  received: z.literal(true),
});
