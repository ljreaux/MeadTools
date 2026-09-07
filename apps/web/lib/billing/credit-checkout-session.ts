import type { CreditPack } from "@meadtools/credit-accounting";
import type Stripe from "stripe";

/** Stripe Managed Payments: AIaaS, cloud-based, personal use. */
export const MEADTOOLS_PROMPT_CREDITS_TAX_CODE = "txcd_10105001";

/**
 * Creates the hosted, one-time Checkout request for a fixed internal-credit
 * pack. Managed Payments selects supported payment methods dynamically, so do
 * not add `payment_method_types` here.
 */
export function buildCreditCheckoutSessionParams(options: {
  checkoutId: string;
  pack: CreditPack;
  successUrl: string;
  cancelUrl: string;
  userId: number;
}): Stripe.Checkout.SessionCreateParams {
  const { checkoutId, pack, successUrl, cancelUrl, userId } = options;
  return {
    mode: "payment",
    managed_payments: { enabled: true },
    client_reference_id: String(userId),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack.amountCents,
          tax_behavior: "exclusive",
          product_data: {
            name: `${pack.credits.toLocaleString("en-US")} MeadTools prompt credits`,
            tax_code: MEADTOOLS_PROMPT_CREDITS_TAX_CODE,
          },
        },
      },
    ],
    metadata: {
      credit_checkout_id: checkoutId,
      credit_pack_id: pack.id,
      credits: String(pack.credits),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  };
}
