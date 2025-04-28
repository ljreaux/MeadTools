import {
  verifyToken,
  registerDevice,
  updateBrewGravity,
  createLog,
  startBrew,
} from "@/lib/db/iSpindel";
import { parseNumber } from "@/lib/utils/validateInput";
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
  Beer: string;
  Temp?: number | string;
  SG?: number | string;
  Color?: Colors;
  Comment?: string;
  Timepoint?: number | string;
};

function parseFormData(formData: string): TiltRequest {
  const params = new URLSearchParams(formData);
  const result: Record<string, any> = {};

  for (const [key, value] of params.entries()) {
    const trimmedValue = value.trim();
    const num = Number(trimmedValue);

    result[key] = !isNaN(num) && trimmedValue !== "" ? num : trimmedValue;
  }

  return result as TiltRequest;
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim();

  const contentType = req.headers.get("content-type") || "";

  let body: TiltRequest;

  if (contentType.includes("application/json")) {
    body = await req.json();
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await req.text();
    body = parseFormData(formData);
  } else {
    return NextResponse.json(
      { error: "Unsupported content type" },
      { status: 415 }
    );
  }

  const { Beer, Temp, SG, Color } = body;

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
    if (Beer && Beer !== "Untitled" && !brew_id) {
      try {
        const [brew] = await startBrew(device_id, userId, Beer);
        brew_id = brew.id;
      } catch (startErr: any) {
        console.warn("Brew not started:", startErr.message);
      }
    }

    if (brew_id) await updateBrewGravity(brew_id, parseNumber(SG));

    const log = await createLog({
      brew_id,
      device_id,
      temperature: parseNumber(Temp),
      temp_units: "F",
      gravity: parseNumber(SG),
      calculated_gravity: parseNumber(SG),
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
