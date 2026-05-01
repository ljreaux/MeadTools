import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import prisma from "@/lib/prisma";

const { RESET_PASSWORD_SECRET = "" } = process.env;

/**
 * Reset password
 * @description Updates a user's password using a valid password-reset token.
 * @body ResetPasswordRequestBody
 * @response 200:ResetPasswordSuccessResponse
 * @responseSet none
 * @add 400:ResetPasswordValidationErrorResponse
 * @add 401:ResetPasswordInvalidTokenErrorResponse
 * @tag Authentication
 * @openapi
 */
export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json(
      { error: "Missing token or password." },
      { status: 400 }
    );
  }

  try {
    const payload = jwt.verify(token, RESET_PASSWORD_SECRET) as {
      userId: string;
    };

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.users.update({
      where: { id: Number(payload.userId) },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (err: any) {
    console.error("Reset password error:", err);
    return NextResponse.json(
      { error: "Invalid or expired token." },
      { status: 401 }
    );
  }
}
