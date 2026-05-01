import {
  createLog,
  registerDevice,
  sendEmailUpdate,
  updateBrewGravity,
  verifyToken,
} from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

/**
 * RAPT Pill log
 * @description Intended for RAPT Pill devices to post readings to MeadTools. Registers or finds a device by name and writes a hydrometer log using the user's hydrometer token.
 * @body HydrometerIngestRequestBody
 * @response 200:HydrometerLogResponse
 * @responseSet none
 * @add 400:HydrometerAuthErrorResponse
 * @add 404:HydrometerAuthErrorResponse
 * @add 500:HydrometerLogErrorResponse
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
    await sendEmailUpdate(brew_id);

    const data = {
      ...body,
      calculated_gravity: null,
      brew_id,
      device_id: device.id,
    };

    const log = await createLog(data);
    return NextResponse.json(log, { status: 200 });
  } catch (error) {
    console.error("Error logging:", error);
    return NextResponse.json({ error: "Failed to log" }, { status: 500 });
  }
}
