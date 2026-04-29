import {
  registerDevice,
  updateBrewGravity,
  verifyToken,
} from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

/**
 * Register RAPT Pill device
 * @description Intended for RAPT Pill devices or integrations to register with MeadTools. Registers or finds a device by name and returns the device record.
 * @body RaptPillRegisterRequestBody
 * @response 200:HydrometerDeviceResponse
 * @responseSet none
 * @add 400:HydrometerAuthErrorResponse
 * @add 404:HydrometerAuthErrorResponse
 * @add 500:RaptPillRegisterErrorResponse
 * @tag Hydrometer Logging
 * @openapi
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body || !body.token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  try {
    const userId = await verifyToken(body.token);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const newDevice = { userId, device_name: body.name };
    const device = await registerDevice(newDevice);
    const { brew_id } = device;

    const gravity = body.gravity;

    if (!!brew_id) await updateBrewGravity(brew_id, gravity);

    return NextResponse.json(device, { status: 200 });
  } catch (error) {
    console.error("Error logging:", error);
    return NextResponse.json(
      { error: "Failed to get device info" },
      { status: 500 }
    );
  }
}
