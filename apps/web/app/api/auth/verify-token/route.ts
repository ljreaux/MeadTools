import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import {
  getAllowedGoogleAudiences
} from "@/lib/auth/google-audience";
import { verifyGoogleTokenEmail } from "@/lib/auth/google-token";
const {
  ACCESS_TOKEN_SECRET = "",
  REFRESH_TOKEN_SECRET = ""
} = process.env;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify OAuth token
 * @description Verifies a Google ID token or access token and returns a MeadTools access token for an existing user.
 * @body VerifyTokenRequestBody
 * @response 200:VerifyTokenSuccessResponse
 * @responseSet none
 * @add 400:VerifyTokenValidationErrorResponse
 * @add 401:VerifyTokenUnauthorizedErrorResponse
 * @add 404:VerifyTokenNotFoundErrorResponse
 * @add 500:VerifyTokenFailureErrorResponse
 * @tag Authentication
 * @openapi
 */
export async function POST(req: NextRequest) {
  try {
    const { token, provider } = await req.json();

    if (provider !== "google") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    let email: string | null;
    try {
      email = await verifyGoogleTokenEmail({
        token,
        allowedAudiences: getAllowedGoogleAudiences(),
        client: googleClient
      });
    } catch (error) {
      console.error("Google token verification error:", error);
      return NextResponse.json(
        { error: "Invalid ID token" },
        { status: 401 }
      );
    }

    if (!email) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const accessToken = jwt.sign({ id: user.id }, ACCESS_TOKEN_SECRET, {
      expiresIn: "1w"
    });
    const refreshToken = jwt.sign({ id: user.id }, REFRESH_TOKEN_SECRET, {
      expiresIn: "2w"
    });

    return NextResponse.json({
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role || "user"
      }
    });
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
