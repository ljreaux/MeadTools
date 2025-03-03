import { verifyUser } from "@/lib/userAccessFunctions";
import { deleteDevice, updateCoefficients } from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ device_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }
  const userId = userOrResponse;

  const { device_id } = await params;
  const body = await req.json();
  try {
    const device = await updateCoefficients(
      userId,
      device_id,
      body.coefficients
    );
    return NextResponse.json(device, { status: 200 });
  } catch (error) {
    console.error("Error updating device:", error);
    return NextResponse.json(
      { error: "Failed to update device." },
      { status: 500 }
    );
  }
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ device_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }
  const userId = userOrResponse;

  const { device_id } = await params;
  try {
    const device = await deleteDevice(device_id, userId);
    return NextResponse.json(device, { status: 200 });
  } catch (error) {
    console.error("Error deleting device:", error);
    return NextResponse.json(
      { error: "Failed to delete device." },
      { status: 500 }
    );
  }
}
