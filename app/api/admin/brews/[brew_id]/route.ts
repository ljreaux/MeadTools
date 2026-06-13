import { NextRequest, NextResponse } from "next/server";

import { getAdminBrew } from "@/lib/db/admin";
import { verifyAdmin } from "@/lib/userAccessFunctions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string }> }
) {
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) return adminOrResponse;

  const { brew_id } = await params;
  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew id." }, { status: 400 });
  }

  try {
    const brew = await getAdminBrew(brew_id);
    if (!brew) {
      return NextResponse.json({ error: "Brew not found." }, { status: 404 });
    }

    return NextResponse.json(brew);
  } catch (error) {
    console.error("GET /api/admin/brews/[brew_id] failed:", error);
    return NextResponse.json(
      { error: "Failed to load brew." },
      { status: 500 }
    );
  }
}
