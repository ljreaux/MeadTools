import { NextRequest, NextResponse } from "next/server";
import {
  adminReleaseEmailOverviewResponseSchema,
  adminReleaseEmailRequestBodySchema,
} from "@meadtools/api-contract/release-emails";
import {
  prepareReleaseEmails,
  releaseEmailOverview,
  sendReleaseEmailBatch,
} from "@/lib/db/release-email-deliveries";
import { verifyAdmin } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Show available dated product releases and delivery counts to an administrator.
 * @response 200:AdminReleaseEmailOverviewResponse
 * @responseSet none
 * @add 401:ReleaseEmailPreferencesErrorResponse
 * @add 403:ReleaseEmailPreferencesErrorResponse
 * @add 500:ReleaseEmailPreferencesErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    return NextResponse.json(adminReleaseEmailOverviewResponseSchema.parse(await releaseEmailOverview()));
  } catch {
    return NextResponse.json({ error: "Unable to load release email status." }, { status: 500 });
  }
}

/**
 * Explicitly prepare recipients or send the next ten messages for one product.
 * @body AdminReleaseEmailRequestBody
 * @response 200:AdminReleaseEmailOverviewResponse
 * @responseSet none
 * @add 400:ReleaseEmailPreferencesErrorResponse
 * @add 401:ReleaseEmailPreferencesErrorResponse
 * @add 403:ReleaseEmailPreferencesErrorResponse
 * @add 500:ReleaseEmailPreferencesErrorResponse
 * @add 503:ReleaseEmailPreferencesErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const input = adminReleaseEmailRequestBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!input.success) {
    return NextResponse.json({ error: "Invalid release email request." }, { status: 400 });
  }
  const { date, product, action, confirmation } = input.data;
  if (confirmation !== `${action.toUpperCase()} ${date} ${product.toUpperCase()}`) {
    return NextResponse.json({ error: "Confirmation does not match the release and product." }, { status: 400 });
  }
  try {
    const result = action === "prepare"
      ? await prepareReleaseEmails(date, product)
      : await sendReleaseEmailBatch(date, product);
    return NextResponse.json(adminReleaseEmailOverviewResponseSchema.parse(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Release email action failed.";
    const status = message.includes("configuration") || message.includes("restricted") ? 503 :
      message.includes("no shipped notes") ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "Release email action failed." : message }, { status });
  }
}
