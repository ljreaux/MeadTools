import { getLogs } from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

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
