import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db/users";
import { sendPasswordResetEmail } from "@/lib/auth/passwordReset";

/**
 * Request password reset
 * @description Sends a password reset email when the address belongs to an account. The response does not reveal whether the user exists.
 * @body RequestPasswordResetBody
 * @response 200:RequestPasswordResetSuccessResponse
 * @responseSet none
 * @add 400:RequestPasswordResetValidationErrorResponse
 * @tag Authentication
 * @openapi
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    // Do not reveal if the user exists
    return NextResponse.json({
      message: "If that email exists, a reset link has been sent."
    });
  }

  await sendPasswordResetEmail({ userId: user.id, email: user.email });

  return NextResponse.json({ message: "Reset link sent." });
}
