import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/authorize-cron";
import { failAbandonedPendingChatMessages } from "@/lib/db/chat-conversations";
import { reverseAbandonedCreditReservations } from "@/lib/db/credit-accounting";

/**
 * Reconcile interrupted hosted-chat turns. This runs separately from the
 * daily activity cleanup so temporarily reserved credits are not held until
 * the following day when a browser or function disconnects mid-turn.
 */
export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!isAuthorizedCronRequest(authorization)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const [creditReservations, pendingMessages] = await Promise.all([
      reverseAbandonedCreditReservations(),
      failAbandonedPendingChatMessages(),
    ]);
    return NextResponse.json({ ok: true, creditReservations, pendingMessages });
  } catch (error) {
    console.error("Unable to reconcile interrupted chat turns.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, error: "Chat reconciliation failed" },
      { status: 500 },
    );
  }
}
