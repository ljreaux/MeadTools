import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getUserById } from "@/lib/db/users";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

const { ACCESS_TOKEN_SECRET = "" } = process.env;

export async function requireAdmin(userId: number): Promise<boolean> {
  const user = await getUserById(userId);
  return user?.role === "admin";
}
export async function verifyUser(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header missing" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      console.error("Token missing");
      return NextResponse.json({ error: "Token missing" }, { status: 401 });
    }

    let userId: number | string | null = null;
    // Try verifying as a custom token
    try {
      const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as { id: number };
      userId = decoded?.id;

      // Fetch the user by custom ID
      const user = await prisma.users.findUnique({
        where: { id: userId },
      });

      if (!user) {
        console.error("User not found for custom token");
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return user.id;
    } catch (err) {
      console.warn("Failed to verify custom token:", err);
    }

    // If not a custom token, try getting the user from the session
    if (!userId) {
      const session = await getServerSession(authOptions);

      if (session?.user?.email) {
        const user = await prisma.users.findUnique({
          where: { email: session.user.email },
        });

        if (user) {
          return user.id;
        }
      }

      // If Google profile.sub is stored as google_id
      if (session?.user?.id) {
        const user = await prisma.users.findUnique({
          // @ts-expect-error Works fine, but throws a ts error
          where: { google_id: session.user.id as string }, // Assuming profile.sub is mapped to google_id
        });

        if (user) {
          return user.id;
        }
      }
    }

    // If no valid userId, return an error
    console.error(
      "No valid userId found. Invalid token or unauthorized access."
    );
    return NextResponse.json(
      { error: "Invalid token or unauthorized access" },
      { status: 401 }
    );
  } catch (error) {
    console.error("Error verifying user:", error);
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}

export async function verifyAdmin(
  req: NextRequest
): Promise<number | NextResponse> {
  const userIdOrResponse = await verifyUser(req);

  if (userIdOrResponse instanceof NextResponse) {
    return userIdOrResponse;
  }

  try {
    const user = await getUserById(userIdOrResponse);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    return user.id;
  } catch {
    return NextResponse.json(
      { error: "Failed to verify admin" },
      { status: 500 }
    );
  }
}
