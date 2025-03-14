import { verifyUser } from "@/lib/userAccessFunctions";
import { deleteLog, getLogsForBrew, updateLog } from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: brew_id } = await params;
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }
  const userId = userOrResponse;
  try {
    const logs = await getLogsForBrew(brew_id, userId);
    return NextResponse.json(logs, { status: 200 });
  } catch (error) {
    console.error("Error fetching logs for brew:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }

  const body = await req.json();
  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id");
  const { id: logId } = await params;

  if (!device_id) {
    return NextResponse.json(
      { error: "Missing device_id parameter" },
      { status: 400 }
    );
  }
  try {
    const log = await updateLog(logId, device_id, body);
    return NextResponse.json(log, { status: 200 });
  } catch (error) {
    console.error("Error updating log:", error);
    return NextResponse.json(
      { error: "Failed to update log." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }

  const { id: logId } = await params;
  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id");

  try {
    if (!device_id) {
      // If the device_id is missing, throw a specific error
      return NextResponse.json(
        { error: "Must provide a device id." },
        { status: 400 }
      );
    }

    const log = await deleteLog(logId, device_id);
    return NextResponse.json(log, { status: 200 });
  } catch (error) {
    console.error("Error deleting log:", error);
    return NextResponse.json(
      { error: "Failed to delete log." },
      { status: 500 }
    );
  }
}
