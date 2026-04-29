import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db/users";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const { ACCESS_TOKEN_SECRET = "", REFRESH_TOKEN_SECRET = "" } = process.env;

/**
 * Log in
 * @description Authenticates a user with email and password and returns access and refresh tokens.
 * @body LoginRequestBody
 * @response 200:LoginSuccessResponse
 * @responseSet none
 * @add 400:LoginMissingCredentialsErrorResponse
 * @add 401:LoginInvalidCredentialsErrorResponse
 * @add 500:LoginFailureErrorResponse
 * @tag Authentication
 * @openapi
 */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Please provide email and password" },
      { status: 400 }
    );
  }

  try {
    const user = await getUserByEmail(email);
    if (
      user &&
      user.password &&
      (await bcrypt.compare(password, user.password))
    ) {
      const accessToken = jwt.sign({ id: user.id }, ACCESS_TOKEN_SECRET, {
        expiresIn: "1w",
      });
      const refreshToken = jwt.sign({ id: user.id }, REFRESH_TOKEN_SECRET, {
        expiresIn: "2w",
      });

      return NextResponse.json(
        {
          message: "Successfully logged in!",
          accessToken,
          refreshToken,
          role: user.role,
          email: user.email,
          id: user.id,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Error logging in user:", error);
    return NextResponse.json(
      { error: "Failed to log in user" },
      { status: 500 }
    );
  }
}
