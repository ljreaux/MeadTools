import {
  deleteBrewForApp,
  getBrewForApp,
  patchBrewMetadata
} from "@/lib/db/brews";
import { verifyUser } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const userId = userOrResponse;
  const { brew_id } = await params;

  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }

  try {
    const brew = await getBrewForApp(userId, brew_id);
    return NextResponse.json(brew, { status: 200 });
  } catch (err) {
    console.error("Error fetching brew:", err);
    return NextResponse.json(
      { error: "Failed to fetch brew." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const userId = userOrResponse;
  const { brew_id } = await params;

  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  try {
    const updated = await patchBrewMetadata(userId, brew_id, body);
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error("Error updating brew:", err);
    return NextResponse.json(
      { error: "Failed to update brew." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }
  const userId = userOrResponse;

  const { brew_id } = await params; // Resolve params as Promise

  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }
  try {
    await deleteBrewForApp(brew_id, userId);
    return NextResponse.json(
      { message: "Brew deleted successfully." },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error deleting brew:", err);
    return NextResponse.json(
      { error: "Failed to delete brew." },
      { status: 500 }
    );
  }
}
