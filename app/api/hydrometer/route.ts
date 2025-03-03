import { verifyUser } from "@/lib/userAccessFunctions";
import { getDevicesForUser, getHydrometerToken } from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Verify user authentication
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }
  const userId = userOrResponse;
  try {
    const hydro_token = await getHydrometerToken(userId);
    const devices = await getDevicesForUser(userId);

    return NextResponse.json({ ...hydro_token, devices }, { status: 200 });
  } catch (err) {
    console.error("Error fetching hydro_token:", err);
    return NextResponse.json(
      { error: "Failed to fetch hydro_token" },
      { status: 500 }
    );
  }
}
