import { z } from "zod";

const kofiPaymentSchema = z
  .object({
    verification_token: z.string().min(1).max(256),
    message_id: z.string().min(1).max(128),
    kofi_transaction_id: z.string().min(1).max(128),
    timestamp: z.string().datetime({ offset: true }),
    type: z.string(),
    is_subscription_payment: z.boolean(),
    email: z.string().trim().email().max(255),
    amount: z.string().regex(/^\d{1,8}(?:\.\d{1,2})?$/),
    currency: z.string().regex(/^[A-Za-z]{3}$/)
  })
  .passthrough();

export type KofiSubscriptionPayment = {
  verificationToken: string;
  messageId: string;
  transactionId: string;
  paidAt: Date;
  email: string;
  amountCents: number;
  currency: string;
};

export function parseKofiSubscriptionPayment(
  value: unknown,
  now = new Date()
): KofiSubscriptionPayment | null {
  const parsed = kofiPaymentSchema.safeParse(value);
  console.log(parsed);
  if (!parsed.success) return null;
  const data = parsed.data;
  if (data.type !== "Subscription" || !data.is_subscription_payment) {
    return null;
  }
  const paidAt = new Date(data.timestamp);
  if (paidAt.getTime() > now.getTime() + 5 * 60_000) return null;
  const [dollars, cents = ""] = data.amount.split(".");
  const amountCents = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return null;
  return {
    verificationToken: data.verification_token,
    messageId: data.message_id,
    transactionId: data.kofi_transaction_id,
    paidAt,
    email: data.email.trim().toLowerCase(),
    amountCents,
    currency: data.currency.toLowerCase()
  };
}

export function kofiPaymentIsPremiumEligible(options: {
  amountCents: number;
  currency: string;
  grandfathered: boolean;
}): boolean {
  return (
    options.grandfathered ||
    (options.currency === "usd" && options.amountCents >= 500)
  );
}
