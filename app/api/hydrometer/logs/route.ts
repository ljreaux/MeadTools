import { getLogs } from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

/**
 * List hydrometer logs by device
 * @description Returns logs for a device between start_date and end_date. This endpoint currently uses device_id query lookup and does not require bearer auth.
 * @params HydrometerLogsQueryParams
 * @response 200:HydrometerLogsResponse
 * @responseSet none
 * @add 400:HydrometerLogValidationErrorResponse
 * @tag Hydrometer
 * @openapi
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDateString = searchParams.get("start_date");
  const endDateString = searchParams.get("end_date");
  try {
    if (!startDateString) throw new Error("Invalid start date.");

    const start_date = new Date(startDateString);
    const end_date = endDateString
      ? new Date(endDateString)
      : new Date(Date.now());

    const device_id = searchParams.get("device_id");
    if (!device_id) throw new Error("Invalid device ID.");

    const logs = await getLogs(device_id, start_date, end_date);
    return NextResponse.json(logs);
  } catch (err) {
    console.error("Error parsing date:", err);
    return NextResponse.json(
      { error: "Date or Device Id error" },
      { status: 400 }
    );
  }
}
