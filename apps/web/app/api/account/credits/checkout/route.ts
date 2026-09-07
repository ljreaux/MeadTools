import { NextRequest, NextResponse } from "next/server";
import { createCreditCheckoutRequestBodySchema } from "@meadtools/api-contract/credits";
import { verifyUser } from "@/lib/userAccessFunctions";
import {
  CreditCheckoutUnavailableError,
  UnknownCreditPackError,
  createCreditCheckout,
} from "@/lib/billing/credit-checkout";
import { CreditPaymentRestrictedError } from "@/lib/db/credit-accounting";
import { areCreditPurchasesAvailable } from "@/lib/billing/credit-purchase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a Stripe Checkout Session for one fixed prompt-credit pack.
 * @body CreateCreditCheckoutRequestBody
 * @response 200:CreateCreditCheckoutResponse
 * @responseSet none
 * @add 400:CreditAccountErrorResponse
 * @add 401:CreditAccountErrorResponse
 * @add 403:CreditAccountErrorResponse
 * @add 500:CreditAccountErrorResponse
 * @add 503:CreditAccountErrorResponse
 * @auth BearerAuth
 * @tag Account
 * @openapi
 */
export async function POST(request: NextRequest) {
  const userId = await verifyUser(request);
  if (userId instanceof NextResponse || typeof userId !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!areCreditPurchasesAvailable()) {
    return NextResponse.json(
      { error: "Credit purchases are not available." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createCreditCheckoutRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid credit pack." },
      { status: 400 },
    );
  }

  try {
    const origin = request.nextUrl.origin;
    const checkout = await createCreditCheckout({
      userId,
      packId: parsed.data.packId,
      successUrl: new URL(
        "/account/chat?tab=credits&creditCheckout=success",
        origin,
      ).toString(),
      cancelUrl: new URL(
        "/account/chat?creditCheckout=cancelled",
        origin,
      ).toString(),
    });
    return NextResponse.json(checkout);
  } catch (error) {
    if (error instanceof UnknownCreditPackError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof CreditCheckoutUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof CreditPaymentRestrictedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Unable to create credit checkout.", {
      userId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Unable to create credit checkout." },
      { status: 500 },
    );
  }
}
