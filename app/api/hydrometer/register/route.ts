import { verifyUser } from "@/lib/userAccessFunctions";
import { createHydrometerToken } from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }
  const userId = userOrResponse;
  try {
    const token = await createHydrometerToken(userId);
    return NextResponse.json(token, { status: 200 });
  } catch (err) {
    console.error("Error creating hydro_token:", err);
    return NextResponse.json(
      { error: "Failed to create hydro_token" },
      { status: 500 }
    );
  }
}
