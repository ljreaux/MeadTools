import { verifyUser } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";
import { patchBrewEntryForApp, deleteBrewEntryForApp } from "@/lib/db/brews";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string; entry_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const userId = userOrResponse;

  const { brew_id, entry_id } = await params;

  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }
  if (!entry_id) {
    return NextResponse.json({ error: "Missing entry_id" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const entry = await patchBrewEntryForApp(userId, brew_id, entry_id, body);
    return NextResponse.json({ entry }, { status: 200 });
  } catch (err) {
    console.error("POST /api/brews/[brew_id]/entries/[entry_id] failed:", err);
    return NextResponse.json(
      { error: "Failed to update entry." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string; entry_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const userId = userOrResponse;

  const { brew_id, entry_id } = await params;

  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }
  if (!entry_id) {
    return NextResponse.json({ error: "Missing entry_id" }, { status: 400 });
  }

  try {
    await deleteBrewEntryForApp(userId, brew_id, entry_id);
    return NextResponse.json(
      { message: "Entry deleted successfully." },
      { status: 200 }
    );
  } catch (err) {
    console.error(
      "DELETE /api/brews/[brew_id]/entries/[entry_id] failed:",
      err
    );
    return NextResponse.json(
      { error: "Failed to delete entry." },
      { status: 500 }
    );
  }
}
