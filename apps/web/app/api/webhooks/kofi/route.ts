import { NextRequest, NextResponse } from "next/server";
import { kofiWebhookReceiptResponseSchema } from "@meadtools/api-contract/premium";
import { parseKofiSubscriptionPayment } from "@meadtools/premium-domain";
import {
  KofiLinkConflictError,
  KofiPremiumUnavailableError,
  recordKofiSubscriptionPayment,
  verifyKofiWebhookToken
} from "@/lib/billing/kofi-premium";

export const runtime = "nodejs";

/**
 * Receive and deduplicate verified Ko-fi recurring payment notifications.
 * @response 200:KofiWebhookReceiptResponse
 * @responseSet none
 * @add 400:PremiumErrorResponse
 * @add 401:PremiumErrorResponse
 * @add 409:PremiumErrorResponse
 * @add 413:PremiumErrorResponse
 * @add 415:PremiumErrorResponse
 * @add 500:PremiumErrorResponse
 * @add 503:PremiumErrorResponse
 * @tag Webhooks
 * @openapi
 */
export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  if (
    !request.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded")
  ) {
    return NextResponse.json(
      { error: "Unsupported content type" },
      { status: 415 }
    );
  }
  let payload: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 16_384) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    const form = new URLSearchParams(text);
    const data = form.get("data");
    if (!data) throw new Error("Missing data");
    payload = JSON.parse(data);
  } catch {
    return NextResponse.json(
      { error: "Invalid Ko-fi payload" },
      { status: 400 }
    );
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload) ||
    typeof (payload as Record<string, unknown>).verification_token !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid Ko-fi payload" },
      { status: 400 }
    );
  }
  try {
    if (
      !verifyKofiWebhookToken(
        (payload as Record<string, string>).verification_token
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payment = parseKofiSubscriptionPayment(payload);
    if (payment) await recordKofiSubscriptionPayment(payment);
    return NextResponse.json(
      kofiWebhookReceiptResponseSchema.parse({ received: true })
    );
  } catch (error) {
    if (error instanceof KofiPremiumUnavailableError) {
      return NextResponse.json(
        { error: "Ko-fi webhook is unavailable" },
        { status: 503 }
      );
    }
    if (error instanceof KofiLinkConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Ko-fi webhook failed.", {
      error: error instanceof Error ? error.name : "unknown"
    });
    return NextResponse.json(
      { error: "Unable to process payment" },
      { status: 500 }
    );
  }
}
