import { NextRequest, NextResponse } from "next/server";
import {
  releaseEmailUnsubscribeRequestBodySchema,
  releaseEmailUnsubscribeResponseSchema,
} from "@meadtools/api-contract/release-emails";
import { unsubscribeReleaseEmail } from "@/lib/db/release-email-unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Opt out of one product's release emails using an opaque email-link token.
 * A GET request never changes consent; the user confirms on the linked page.
 * @body ReleaseEmailUnsubscribeRequestBody
 * @response 200:ReleaseEmailUnsubscribeResponse
 * @responseSet none
 * @add 400:ReleaseEmailPreferencesErrorResponse
 * @add 404:ReleaseEmailPreferencesErrorResponse
 * @add 500:ReleaseEmailPreferencesErrorResponse
 * @tag Account
 * @openapi
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = releaseEmailUnsubscribeRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid unsubscribe link." },
      { status: 400 },
    );
  }
  try {
    const found = await unsubscribeReleaseEmail(parsed.data);
    if (!found) {
      return NextResponse.json(
        { error: "Unsubscribe link not found." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      releaseEmailUnsubscribeResponseSchema.parse({ unsubscribed: true }),
    );
  } catch (error) {
    console.error("Unable to unsubscribe from release emails.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Unable to unsubscribe." },
      { status: 500 },
    );
  }
}
