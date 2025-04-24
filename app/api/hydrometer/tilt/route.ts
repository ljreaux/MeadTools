import {
  verifyToken,
  registerDevice,
  updateBrewGravity,
  createLog,
  startBrew,
} from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

enum Colors {
  Blue = "BLUE",
  Black = "BLACK",
  Red = "RED",
  Orange = "ORANGE",
  Yellow = "YELLOW",
  Purple = "PURPLE",
  Pink = "PINK",
}

type TiltRequest = {
  Beer?: string;
  Temp?: number;
  SG?: number;
  Color?: Colors;
  Comment?: string;
  Timepoint?: number;
};

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim();

  const body: TiltRequest = await req.json();
  const { Beer, Temp, SG, Color, Timepoint } = body;

  if (!token || !Temp || !SG || !Color) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    const userId = await verifyToken(token);
    if (userId instanceof NextResponse) return userId;

    const device = await registerDevice({
      userId,
      device_name: `${Color.charAt(0).toUpperCase() + Color.slice(1).toLowerCase()} Tilt`,
    });

    const { id: device_id, brew_id: existingBrewId } = device;
    let brew_id = existingBrewId;

    // Start a brew if Beer is defined and no brew is currently attached
    if (Beer && !brew_id) {
      try {
        const [brew] = await startBrew(device_id, userId, Beer);
        brew_id = brew.id;
      } catch (startErr: any) {
        console.warn("Brew not started:", startErr.message);
      }
    }

    if (brew_id) await updateBrewGravity(brew_id, SG);

    const dateTime =
      Timepoint && typeof Timepoint === "number"
        ? new Date((Timepoint - 25569) * 86400 * 1000)
        : new Date();

    const log = await createLog({
      brew_id,
      device_id,
      angle: 0,
      temperature: Temp,
      temp_units: "F",
      battery: 0,
      gravity: SG,
      interval: 0,
      calculated_gravity: SG,
      dateTime,
    });

    return NextResponse.json(log, { status: 200 });
  } catch (err) {
    console.error("Tilt logging error:", err);
    return NextResponse.json(
      { error: "Failed to log Tilt data" },
      { status: 500 }
    );
  }
}
