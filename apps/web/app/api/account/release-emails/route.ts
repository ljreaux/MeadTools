import { NextRequest, NextResponse } from "next/server";
import {
  releaseEmailPreferencesResponseSchema,
  releaseEmailPreferencesUpdateBodySchema,
} from "@meadtools/api-contract/release-emails";
import {
  getReleaseEmailPreferences,
  setReleaseEmailPreferences,
} from "@/lib/db/release-email-preferences";
import { verifyUser } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Get the signed-in user's one product-update email choice.
 * @response 200:ReleaseEmailPreferencesResponse
 * @responseSet none
 * @add 401:ReleaseEmailPreferencesErrorResponse
 * @add 500:ReleaseEmailPreferencesErrorResponse
 * @auth BearerAuth
 * @tag Account
 * @openapi
 */
export async function GET(request: NextRequest) {
  const userId = await verifyUser(request);
  if (userId instanceof NextResponse || typeof userId !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(
      releaseEmailPreferencesResponseSchema.parse(
        await getReleaseEmailPreferences(userId),
      ),
    );
  } catch (error) {
    console.error("Unable to read release email preferences.", {
      userId,
      error,
    });
    return NextResponse.json(
      { error: "Unable to read release email preferences." },
      { status: 500 },
    );
  }
}

/**
 * Record an explicit product-update email decision, including a decline.
 * @body ReleaseEmailPreferencesUpdateBody
 * @response 200:ReleaseEmailPreferencesResponse
 * @responseSet none
 * @add 400:ReleaseEmailPreferencesErrorResponse
 * @add 401:ReleaseEmailPreferencesErrorResponse
 * @add 500:ReleaseEmailPreferencesErrorResponse
 * @auth BearerAuth
 * @tag Account
 * @openapi
 */
export async function PATCH(request: NextRequest) {
  const userId = await verifyUser(request);
  if (userId instanceof NextResponse || typeof userId !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = releaseEmailPreferencesUpdateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid release email preferences." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      releaseEmailPreferencesResponseSchema.parse(
        await setReleaseEmailPreferences(userId, parsed.data),
      ),
    );
  } catch (error) {
    console.error("Unable to save release email preferences.", {
      userId,
      error,
    });
    return NextResponse.json(
      { error: "Unable to save release email preferences." },
      { status: 500 },
    );
  }
}
