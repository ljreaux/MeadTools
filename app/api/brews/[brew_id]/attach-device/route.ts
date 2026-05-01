import { attachDeviceToBrewForApp } from "@/lib/db/brews";
import { verifyUser } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";

/**
 * Attach device to brew
 * @description Attaches one of the authenticated user's hydrometer devices to a brew.
 * @pathParams BrewPathParams
 * @body AttachDeviceToBrewRequestBody
 * @response 200:AttachDeviceToBrewResponse
 * @responseSet none
 * @add 400:BrewDeviceActionErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:BrewDeviceActionErrorResponse
 * @add 500:BrewDeviceActionErrorResponse
 * @auth BearerAuth
 * @tag Brews
 * @openapi
 */
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
    const result = await attachDeviceToBrewForApp(userId, brew_id, {
      device_id: body?.device_id,
      force: body?.force
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/brews/[brew_id]/attach-device failed:", err);

    const msg = typeof err?.message === "string" ? err.message : "Failed";
    const status =
      msg === "Brew not found" || msg === "Device not found" ? 404 : 400;

    return NextResponse.json({ error: msg }, { status });
  }
}
