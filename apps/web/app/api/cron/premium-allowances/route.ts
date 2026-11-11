import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/authorize-cron";
import { deliverDuePremiumAllowances } from "@/lib/billing/premium-allowances";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Internal scheduled delivery; excluded from the public API contract. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...await deliverDuePremiumAllowances() });
  } catch {
    console.error("Unable to deliver premium allowances.");
    return NextResponse.json({ ok: false, error: "Allowance delivery failed" }, { status: 500 });
  }
}
