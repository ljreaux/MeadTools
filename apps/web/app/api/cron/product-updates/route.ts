import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/authorize-cron";
import { sendPendingProductUpdates } from "@/lib/db/product-update-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Internal cron routes are intentionally excluded from public OpenAPI. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization")))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.VERCEL_ENV !== "production")
    return NextResponse.json({ status: "non-production", sent: 0, failed: 0 });
  try {
    const result = await sendPendingProductUpdates();
    if (result.failed) console.error("Product update batch had SMTP failures.", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Product update cron failed.", error);
    return NextResponse.json({ error: "Product update cron failed." }, { status: 500 });
  }
}
