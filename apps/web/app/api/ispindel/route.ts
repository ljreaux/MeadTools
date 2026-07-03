import {
  calcGravity,
  createLog,
  registerDevice,
  sendEmailUpdate,
  updateBrewGravity,
  verifyToken,
} from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

/**
 * iSpindel log
 * @description Intended for iSpindel devices to post readings to MeadTools. Registers or finds a device by name and writes a hydrometer log using the user's hydrometer token.
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
      return userId; // Return error response if the token is invalid
    }

    const newDevice = { userId, device_name: body.name };
    const device = await registerDevice(newDevice);
    const { coefficients, brew_id } = device;

    let calculated_gravity = null;
    if (!!coefficients.length)
      calculated_gravity = calcGravity(coefficients, body.angle);
    const gravity = calculated_gravity ?? body.gravity;

    if (!!brew_id) await updateBrewGravity(brew_id, gravity);

    const data = { ...body, calculated_gravity, brew_id, device_id: device.id };

    const log = await createLog(data);
    await sendEmailUpdate(brew_id);

    return NextResponse.json(log, { status: 200 });
  } catch (error) {
    console.error("Error logging:", error);
    return NextResponse.json({ error: "Failed to log" }, { status: 500 });
  }
}
