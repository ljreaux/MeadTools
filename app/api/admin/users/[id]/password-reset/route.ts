import { NextRequest, NextResponse } from "next/server";

import { sendPasswordResetEmail } from "@/lib/auth/passwordReset";
import { getUserById } from "@/lib/db/users";
import { verifyAdmin } from "@/lib/userAccessFunctions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) return adminOrResponse;

  const { id } = await params;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    await sendPasswordResetEmail({ userId: user.id, email: user.email });

    return NextResponse.json({ message: "Password reset link sent." });
  } catch (error) {
    console.error("POST /api/admin/users/[id]/password-reset failed:", error);
    return NextResponse.json(
      { error: "Failed to send password reset link." },
      { status: 500 }
    );
  }
}
