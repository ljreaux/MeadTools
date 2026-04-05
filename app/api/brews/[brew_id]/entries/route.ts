import { createBrewEntryForApp } from "@/lib/db/brews";
import { verifyUser } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
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

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const brew = await createBrewEntryForApp(userId, brew_id, body);
    return NextResponse.json({ brew }, { status: 201 });
  } catch (err) {
    console.error("Error creating entry:", err);
    return NextResponse.json(
      { error: "Failed to create entry." },
      { status: 500 }
    );
  }
}
