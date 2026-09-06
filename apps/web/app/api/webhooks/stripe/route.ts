import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  finalizeCreditCheckoutTerminalEvent,
  fulfillCreditCheckoutFromStripeEvent,
} from "@/lib/billing/credit-checkout";
import {
  flagStripeDisputeForReview,
  reconcileStripeRefund,
} from "@/lib/billing/credit-payment-recovery";
import {
  isStripeDisputeRecoveryEvent,
  isStripeRefundEvent,
  isTerminalCreditCheckoutEvent,
} from "@/lib/billing/credit-checkout-events";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verify and fulfill a Stripe payment webhook for prompt-credit purchases.
 * @response 200:StripeWebhookReceiptResponse
 * @responseSet none
 * @add 400:CreditAccountErrorResponse
 * @add 500:CreditAccountErrorResponse
 * @add 503:CreditAccountErrorResponse
 * @tag Billing
 * @openapi
 */
export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();
  const signature = request.headers.get("stripe-signature");
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhooks are not configured." },
      { status: 503 },
    );
  }
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 },
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  try {
    if (isStripeRefundEvent(event.type)) {
      await reconcileStripeRefund({
        eventId: event.id,
        eventType: event.type,
        refund: event.data.object as Stripe.Refund,
      });
    } else if (isStripeDisputeRecoveryEvent(event.type)) {
      await flagStripeDisputeForReview({
        eventId: event.id,
        eventType: event.type,
        dispute: event.data.object as Stripe.Dispute,
      });
    } else if (isTerminalCreditCheckoutEvent(event.type)) {
      await finalizeCreditCheckoutTerminalEvent(event);
    } else {
      await fulfillCreditCheckoutFromStripeEvent(event);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Unable to fulfill Stripe credit webhook.", {
      eventId: event.id,
      eventType: event.type,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Unable to fulfill Stripe webhook." },
      { status: 500 },
    );
  }
}
