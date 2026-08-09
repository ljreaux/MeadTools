import { NextRequest, NextResponse } from "next/server";
import {
  chatAccessErrorResponseSchema,
  creditPaymentRecoveryAdministrationResponseSchema
} from "@meadtools/api-contract/admin";
import { getCreditPaymentRecoveryAdministration } from "@/lib/billing/credit-payment-recovery";
import { verifyAdmin } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Return recent payment refunds and disputes so administrators can resolve
 * any wallet that is intentionally restricted for financial review.
 * @response 200:CreditPaymentRecoveryAdministrationResponse
 * @responseSet none
 * @add 401:AdminAuthErrorResponse
 * @add 403:AdminAuthErrorResponse
 * @add 404:AdminAuthErrorResponse
 * @add 500:ChatAccessErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request);
  if (adminId instanceof NextResponse) return adminId;

  try {
    const recoveries = await getCreditPaymentRecoveryAdministration();
    return NextResponse.json(creditPaymentRecoveryAdministrationResponseSchema.parse({
      recoveries: recoveries.map((recovery) => ({
        ...recovery,
        createdAt: recovery.createdAt.toISOString(),
        resolvedAt: recovery.resolvedAt?.toISOString() ?? null
      }))
    }));
  } catch (error) {
    console.error("Unable to load payment recoveries.", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(chatAccessErrorResponseSchema.parse({ error: "Unable to load payment recoveries." }), { status: 500 });
  }
}
