import { NextRequest, NextResponse } from "next/server";
import {
  kofiLinkRequestBodySchema,
  kofiLinkRequestResponseSchema,
} from "@meadtools/api-contract/premium";
import {
  KofiLinkConflictError,
  KofiLinkInvalidError,
  KofiPremiumUnavailableError,
  requestKofiAccountLink,
} from "@/lib/billing/kofi-premium";
import { verifyUser } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";

/**
 * Email a one-time account-link proof to the Ko-fi payer address.
 * @body KofiLinkRequestBody
 * @response 200:KofiLinkRequestResponse
 * @responseSet none
 * @add 400:PremiumErrorResponse
 * @add 401:PremiumErrorResponse
 * @add 403:PremiumErrorResponse
 * @add 409:PremiumErrorResponse
 * @add 413:PremiumErrorResponse
 * @add 503:PremiumErrorResponse
 * @add 500:PremiumErrorResponse
 * @auth BearerAuth
 * @tag Account
 * @openapi
 */
export async function POST(request: NextRequest) {
  const userId = await verifyUser(request);
  if (userId instanceof NextResponse || typeof userId !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 1_024) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 1_024) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = kofiLinkRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid Ko-fi email" }, { status: 400 });
  }
  try {
    const result = await requestKofiAccountLink({ userId, email: parsed.data.email });
    return NextResponse.json(
      kofiLinkRequestResponseSchema.parse({ expiresAt: result.expiresAt.toISOString() }),
    );
  } catch (error) {
    if (error instanceof KofiLinkInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof KofiLinkConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof KofiPremiumUnavailableError) {
      return NextResponse.json({ error: "Ko-fi linking is unavailable" }, { status: 503 });
    }
    console.error("Ko-fi link request failed.", {
      userId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Unable to send link email" }, { status: 500 });
  }
}
