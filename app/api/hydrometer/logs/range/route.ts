import { verifyUser } from "@/lib/userAccessFunctions";
import { deleteLogsInRange } from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  {}: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }

  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id");
  const startDateString = searchParams.get("start_date");
  const endDateString = searchParams.get("end_date");

  if (!device_id || !startDateString || !endDateString) {
    return NextResponse.json(
      { error: "Missing device_id, start_date, or end_date parameters" },
      { status: 400 }
    );
  }

  try {
    const start_date = new Date(startDateString);
    const end_date = new Date(endDateString);

    await deleteLogsInRange(device_id, start_date, end_date);
    return NextResponse.json(
      {
        message: `Logs from ${start_date} to ${end_date} were deleted successfully.`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting log:", error);
    return NextResponse.json({ error: "Error deleting log." }, { status: 400 });
  }
}
