import { NextRequest, NextResponse } from "next/server";
import {
  adminChatUsageQueryParamsSchema,
  adminChatUsageReportResponseSchema,
  chatAccessErrorResponseSchema
} from "@meadtools/api-contract/admin";
import { getAdminChatUsageReport } from "@/lib/db/chat-usage-reporting";
import { verifyAdmin } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Return aggregate, non-sensitive chat operations reporting. Provider cost is
 * sourced from final credit-ledger settlements; chat transcript content is
 * never returned.
 * @response 200:AdminChatUsageReportResponse
 * @responseSet none
 * @add 400:ChatAccessErrorResponse
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

  const parsed = adminChatUsageQueryParamsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      chatAccessErrorResponseSchema.parse({ error: "Invalid chat usage filters." }),
      { status: 400 }
    );
  }

  try {
    const report = await getAdminChatUsageReport({
      ...parsed.data,
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined
    });
    return NextResponse.json(adminChatUsageReportResponseSchema.parse({
      ...report,
      filters: {
        ...report.filters,
        from: report.filters.from.toISOString(),
        to: report.filters.to.toISOString()
      },
      users: report.users.map((user) => ({
        ...user,
        lastActivityAt: user.lastActivityAt?.toISOString() ?? null
      }))
    }));
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json(
        chatAccessErrorResponseSchema.parse({ error: error.message }),
        { status: 400 }
      );
    }
    console.error("Unable to load chat usage reporting.", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      chatAccessErrorResponseSchema.parse({ error: "Unable to load chat usage reporting." }),
      { status: 500 }
    );
  }
}
