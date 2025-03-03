import { verifyUser } from "@/lib/userAccessFunctions";
import { endBrew, getBrews, setBrewName, startBrew } from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }
  const userId = userOrResponse;
  try {
    const brews = await getBrews(userId);
    return NextResponse.json(brews, { status: 200 });
  } catch (error) {
    console.error("Error getting brews:", error);
    return NextResponse.json(
      { error: "Failed to get brews." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json(); // Expecting the request body to be parsed correctly
  const { device_id, brew_name } = body;

  if (!device_id || !brew_name) {
    return NextResponse.json(
      { error: "Missing device_id or brew_name" },
      { status: 400 }
    );
  }

  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }
  const userId = userOrResponse;

  try {
    const brew = await startBrew(device_id, userId, brew_name);
    return NextResponse.json(brew, { status: 200 });
  } catch (error) {
    console.error("Error creating brew:", error);
    return NextResponse.json(
      { error: "Failed to create brew." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }
  const userId = userOrResponse;
  const body = await req.json(); // Expecting the request body to be parsed correctly
  const { device_id, brew_id, brew_name } = body;

  if (!device_id || !brew_id) {
    return NextResponse.json(
      { error: "Missing device_id, brew_id, or brew_name" },
      { status: 400 }
    );
  }
  try {
    let res;
    if (!brew_name) {
      res = await endBrew(device_id, brew_id, userId);
    } else {
      res = await setBrewName(brew_id, brew_name, userId);
    }
    return NextResponse.json(res, { status: 200 });
  } catch (error) {
    console.error("Error updating brew:", error);
    return NextResponse.json(
      { error: "Failed to update brew." },
      { status: 500 }
    );
  }
}
