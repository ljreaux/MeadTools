import {
  createLog,
  registerDevice,
  updateBrewGravity,
  verifyToken,
} from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
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
