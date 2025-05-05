import {
  createLog,
  LogType,
  registerDevice,
  updateBrewGravity,
  verifyToken,
} from "@/lib/db/iSpindel";
import { toFahrenheit } from "@/lib/utils/temperature";
import { parseNumber } from "@/lib/utils/validateInput";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  console.log(body);

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

    console.log(newDevice, device, brew_id);

    const gravity = body.gravity;

    if (!!brew_id) await updateBrewGravity(brew_id, gravity);

    const data: LogType = {
      ...body,
      temperature:
        body.temp_units === "C"
          ? parseNumber(body.temperature)
          : toFahrenheit(parseNumber(body.temperature)),
      calculated_gravity: null,
      brew_id,
      device_id: device.id,
    };

    const log = await createLog(data);
    console.log(log);
    return NextResponse.json(log, { status: 200 });
  } catch (error) {
    console.error("Error logging:", error);
    return NextResponse.json({ error: "Failed to log" }, { status: 500 });
  }
}
