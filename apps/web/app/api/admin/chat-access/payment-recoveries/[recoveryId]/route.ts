import { NextRequest, NextResponse } from "next/server";
import {
  chatAccessErrorResponseSchema,
  creditPaymentRecoveryPathParamsSchema,
  resolveCreditPaymentRecoveryRequestBodySchema,
  resolveCreditPaymentRecoveryResponseSchema,
} from "@meadtools/api-contract/admin";
import {
  CreditPaymentRecoveryNotFoundError,
  CreditPaymentRecoveryResolutionError,
  resolveCreditPaymentRecovery,
} from "@/lib/billing/credit-payment-recovery";
import { verifyAdmin } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolve an administrator-reviewed refund or dispute. The optional immutable
 * adjustment is explicit; releasing chat requires no other open recovery and
 * a non-negative wallet.
 * @path CreditPaymentRecoveryPathParams
 * @body ResolveCreditPaymentRecoveryRequestBody
 * @response 200:ResolveCreditPaymentRecoveryResponse
 * @responseSet none
 * @add 400:ChatAccessErrorResponse
 * @add 401:AdminAuthErrorResponse
 * @add 403:AdminAuthErrorResponse
 * @add 404:ChatAccessErrorResponse
 * @add 500:ChatAccessErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ recoveryId: string }> },
) {
  const adminId = await verifyAdmin(request);
  if (adminId instanceof NextResponse) return adminId;
  const [params, body] = await Promise.all([
    context.params,
    request.json().catch(() => null),
  ]);
  const parsedParams = creditPaymentRecoveryPathParamsSchema.safeParse(params);
  const parsedBody =
    resolveCreditPaymentRecoveryRequestBodySchema.safeParse(body);
  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json(
      chatAccessErrorResponseSchema.parse({
        error: "A valid recovery resolution is required.",
      }),
      { status: 400 },
    );
  }

  try {
    const result = await resolveCreditPaymentRecovery({
      recoveryId: parsedParams.data.recoveryId,
      resolvedByUserId: adminId,
      ...parsedBody.data,
    });
    return NextResponse.json(
      resolveCreditPaymentRecoveryResponseSchema.parse(result),
    );
  } catch (error) {
    if (error instanceof CreditPaymentRecoveryNotFoundError) {
      return NextResponse.json(
        chatAccessErrorResponseSchema.parse({ error: error.message }),
        { status: 404 },
      );
    }
    if (
      error instanceof CreditPaymentRecoveryResolutionError ||
      error instanceof RangeError
    ) {
      return NextResponse.json(
        chatAccessErrorResponseSchema.parse({ error: error.message }),
        { status: 400 },
      );
    }
    console.error("Unable to resolve payment recovery.", {
      recoveryId: parsedParams.data.recoveryId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      chatAccessErrorResponseSchema.parse({
        error: "Unable to resolve payment recovery.",
      }),
      { status: 500 },
    );
  }
}
