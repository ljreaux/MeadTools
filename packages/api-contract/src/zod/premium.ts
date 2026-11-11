import { z } from "zod";

export const premiumAccessResponseSchema = z.object({
  entitled: z.boolean(),
  premiumEnabled: z.boolean(),
  source: z.enum(["kofi", "stripe", "manual"]).nullable(),
  paidThrough: z.string().datetime().nullable(),
  paymentRestricted: z.boolean(),
  kofiLinked: z.boolean(),
  stripeLinked: z.boolean(),
  monthlyPriceCents: z.literal(500),
  monthlyChatCredits: z.literal(1000),
  annualPriceCents: z.literal(5000),
  annualSubscriptionsEnabled: z.boolean(),
  billingInterval: z.enum(["month", "year"]).nullable(),
  scheduledBillingInterval: z.enum(["month", "year"]).nullable(),
  renewalCanceled: z.boolean().default(false),
  subscriptionsEnabled: z.boolean(),
  kofiJoinUrl: z.string().url().nullable(),
  mcpEnabled: z.boolean(),
});

export const premiumErrorResponseSchema = z.object({ error: z.string() });

export const premiumCheckoutResponseSchema = z.object({ url: z.string().url() });
export const premiumCheckoutRequestBodySchema = z.object({ interval: z.enum(["month", "year"]).default("month") }).strict();
export const premiumPlanChangeRequestBodySchema = z.object({ interval: z.enum(["month", "year"]) }).strict();
export const premiumPlanChangeResponseSchema = z.object({ interval: z.enum(["month", "year"]), effectiveAt: z.string().datetime() });
export const premiumPortalResponseSchema = z.object({ url: z.string().url() });

export const kofiLinkRequestBodySchema = z.object({
  email: z.string().trim().email().max(255),
}).strict();

export const kofiLinkRequestResponseSchema = z.object({
  expiresAt: z.string().datetime(),
});

export const kofiLinkClaimRequestBodySchema = z.object({
  token: z.string().min(40).max(60),
}).strict();

export const kofiLinkClaimResponseSchema = z.object({
  linked: z.literal(true),
  activePaymentFound: z.boolean(),
});

export const kofiWebhookReceiptResponseSchema = z.object({ received: z.literal(true) });
