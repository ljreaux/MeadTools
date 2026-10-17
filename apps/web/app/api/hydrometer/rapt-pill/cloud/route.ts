import {
  createLog,
  LogType,
  registerDevice,
  updateBrewGravity,
  verifyToken,
} from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";
import { normalizeRaptCloudPayload } from "@/lib/rapt-cloud";

/**
 * RAPT Pill cloud log
 * @description Accepts RAPT Brew Stream telemetry envelopes and legacy flat payloads. Authenticate with the token query parameter or a legacy body token. Brew Stream temperatures default to Celsius; legacy temperatures default to Fahrenheit. Values are stored with their temperature units.
 * @body RaptPillCloudIngestRequestBody
 * @response 200:HydrometerLogResponse
 * @responseSet none
 * @add 400:RaptPillCloudErrorResponse
 * @add 404:HydrometerAuthErrorResponse
 * @add 500:HydrometerLogErrorResponse
 * @tag Hydrometer Logging
 * @openapi
 */
export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const normalized = normalizeRaptCloudPayload(
    rawBody,
    req.nextUrl.searchParams.get("token"),
  );
  if (!normalized.success) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }
  const { token, name, ...reading } = normalized.data;
  try {
    const userId = await verifyToken(token);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const newDevice = { userId, device_name: name };
    const device = await registerDevice(newDevice);
    const { brew_id } = device;

    const gravity = reading.gravity;

    if (!!brew_id) await updateBrewGravity(brew_id, gravity);

    const data: LogType = {
      ...reading,
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
