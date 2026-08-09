import type Stripe from "stripe";

/**
 * Verifies the provider session still represents the server-created credit
 * pack. Managed Payments can add tax to the final total, so `amount_subtotal`
 * is the stable pack price to compare with our ledger amount.
 */
export function stripeSessionMatchesCreditCheckout(
  session: Stripe.Checkout.Session,
  checkout: {
    pack_id: string;
    credit_amount: number;
    amount_cents: number;
    currency: string;
    stripe_checkout_session_id: string | null;
  }
): boolean {
  return (
    (!checkout.stripe_checkout_session_id || checkout.stripe_checkout_session_id === session.id) &&
    session.metadata?.credit_pack_id === checkout.pack_id &&
    session.metadata?.credits === String(checkout.credit_amount) &&
    session.amount_subtotal === checkout.amount_cents &&
    session.currency?.toLowerCase() === checkout.currency.toLowerCase()
  );
}
