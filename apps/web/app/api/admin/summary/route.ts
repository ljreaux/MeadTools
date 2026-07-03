import { NextRequest, NextResponse } from "next/server";

import { getAdminSummary } from "@/lib/db/admin";
import { verifyAdmin } from "@/lib/userAccessFunctions";

export async function GET(req: NextRequest) {
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) return adminOrResponse;

  try {
    return NextResponse.json(await getAdminSummary());
  } catch (error) {
    console.error("GET /api/admin/summary failed:", error);
    return NextResponse.json(
      { error: "Failed to load admin summary." },
      { status: 500 }
    );
  }
}
