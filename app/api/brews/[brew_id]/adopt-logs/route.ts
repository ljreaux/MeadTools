import { adoptLogsForBrewForApp } from "@/lib/db/brews";
import { verifyUser } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const userId = userOrResponse;

  const { brew_id } = await params;
  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  try {
    const result = await adoptLogsForBrewForApp(userId, brew_id, {
      device_id: body?.device_id,
      start_date: body?.start_date,
      end_date: body?.end_date,
      // if omitted, defaults to only adopting logs where brew_id is NULL
      ...(body && Object.prototype.hasOwnProperty.call(body, "from_brew_id")
        ? { from_brew_id: body.from_brew_id }
        : {})
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/brews/[brew_id]/adopt-logs failed:", err);

    const msg = typeof err?.message === "string" ? err.message : "Failed";
    const status =
      msg === "Brew not found" || msg === "Device not found" ? 404 : 400;

    return NextResponse.json({ error: msg }, { status });
  }
}
