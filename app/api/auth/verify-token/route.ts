import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
const { ACCESS_TOKEN_SECRET = "" } = process.env;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function POST(req: NextRequest) {
  try {
    const { token, provider, email } = await req.json();

    if (provider !== "google") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    let user = null;

    if (token.startsWith("ya29.")) {
      // ✅ If this is an access token, verify user by email instead
      if (!email) {
        return NextResponse.json(
          { error: "Email required when using access token" },
          { status: 400 }
        );
      }

      user = await prisma.users.findUnique({
        where: { email },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    } else {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: token,
          audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        user = await prisma.users.findUnique({
          where: { email: payload.email },
        });

        if (!user) {
          return NextResponse.json(
            { error: "User not found" },
            { status: 404 }
          );
        }
      } catch (error) {
        console.error("ID token verification error:", error);
        return NextResponse.json(
          { error: "Invalid ID token" },
          { status: 401 }
        );
      }
    }

    const accessToken = jwt.sign({ id: user.id }, ACCESS_TOKEN_SECRET, {
      expiresIn: "1w",
    });

    return NextResponse.json({
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role || "user",
      },
    });
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
