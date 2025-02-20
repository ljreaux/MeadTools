import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getUserByEmail } from "@/lib/db/users";

const { REFRESH_TOKEN_SECRET = "", ACCESS_TOKEN_SECRET = "" } = process.env;

export async function POST(req: NextRequest) {
  const { email, refreshToken } = await req.json();

  if (!email || !refreshToken) {
    return NextResponse.json(
      { error: "Email and refreshToken are required" },
      { status: 400 }
    );
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "Invalid email" }, { status: 401 });
    }

    // If token verification fails, return 500 instead of 401
    try {
      jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch (error) {
      console.error("Error verifying token:", error);
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 500 }
      );
    }

    const accessToken = jwt.sign({ id: user.id }, ACCESS_TOKEN_SECRET, {
      expiresIn: "1w",
    });

    return NextResponse.json({ accessToken });
  } catch {
    return NextResponse.json(
      { error: "Failed to refresh token" },
      { status: 500 }
    );
  }
}
