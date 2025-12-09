import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createUser } from "@/lib/db/users";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const { ACCESS_TOKEN_SECRET = "", REFRESH_TOKEN_SECRET = "" } = process.env;

export async function POST(req: NextRequest) {
  const { email, password: unhashed, public_username } = await req.json();

  // Check if email or password is missing
  if (!email || !unhashed) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  try {
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        {
          error: "A user by that email already exists"
        },
        { status: 400 }
      );
    }

    const password = await bcrypt.hash(unhashed, 10);
    const newUser = await createUser({
      email,
      password,
      public_username,
      show_google_avatar: false
    });

    const accessToken = jwt.sign({ id: newUser.id }, ACCESS_TOKEN_SECRET, {
      expiresIn: "1w"
    });
    const refreshToken = jwt.sign({ id: newUser.id }, REFRESH_TOKEN_SECRET, {
      expiresIn: "2w"
    });

    return NextResponse.json({
      message: "Thank you for signing up!",
      accessToken,
      refreshToken,
      role: newUser.role,
      email
    });
  } catch (error) {
    console.error("Error registering user:", error);
    return NextResponse.json(
      { error: "Failed to register user" },
      { status: 500 }
    );
  }
}
