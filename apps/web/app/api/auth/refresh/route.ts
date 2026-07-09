import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getUserByEmail } from "@/lib/db/users";
import { refreshTokenBelongsToUser } from "@/lib/auth/refresh-token";

const { REFRESH_TOKEN_SECRET = "", ACCESS_TOKEN_SECRET = "" } = process.env;

/**
 * Refresh access token
 * @description Exchanges a valid refresh token for a new access token.
 * @body RefreshTokenRequestBody
 * @response 200:RefreshTokenSuccessResponse
 * @responseSet none
 * @add 400:RefreshTokenValidationErrorResponse
 * @add 401:RefreshTokenInvalidEmailErrorResponse
 * @add 500:RefreshTokenFailureErrorResponse
 * @tag Authentication
 * @openapi
 */
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
      const payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

      if (!refreshTokenBelongsToUser(payload, user.id)) {
        throw new Error("Refresh token does not belong to this user");
      }
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
