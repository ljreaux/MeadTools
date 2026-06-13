import { NextRequest, NextResponse } from "next/server";

import { getAdminBrewsPage } from "@/lib/db/admin";
import { verifyAdmin } from "@/lib/userAccessFunctions";

export async function GET(req: NextRequest) {
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) return adminOrResponse;

  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "10");
  const query = req.nextUrl.searchParams.get("query") ?? "";
  const stage = req.nextUrl.searchParams.get("stage") ?? undefined;
  const statusParam = req.nextUrl.searchParams.get("status");
  const status =
    statusParam === "active" || statusParam === "complete"
      ? statusParam
      : undefined;

  try {
    return NextResponse.json(
      await getAdminBrewsPage({ page, limit, query, stage, status })
    );
  } catch (error) {
    console.error("GET /api/admin/brews failed:", error);
    return NextResponse.json(
      { error: "Failed to load brews." },
      { status: 500 }
    );
  }
}
