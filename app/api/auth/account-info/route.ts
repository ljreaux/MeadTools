import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { getUserById, updateUser } from "@/lib/db/users";
import { getAllRecipesForUser } from "@/lib/db/recipes";
import bcrypt from "bcrypt";

export async function GET(req: NextRequest) {
  const userId = await verifyUser(req);
  if (!userId || userId instanceof NextResponse)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const recipes = await getAllRecipesForUser(userId);

    const response = {
      user: {
        ...user,
        password: undefined,
        isGoogleUser: !!user.google_id
      },
      recipes
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching account info:", error);
    return NextResponse.json(
      { error: "Failed to fetch account info" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await verifyUser(req);

  if (!userId || userId instanceof NextResponse) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.password) {
    body.password = await bcrypt.hash(body.password, 10);
  }

  try {
    const updatedUser = await updateUser(userId, body);

    return NextResponse.json({ ...updatedUser, password: undefined });
  } catch (error) {
    console.error("Error updating account info:", error);
    return NextResponse.json(
      { error: "Failed to update account info" },
      { status: 500 }
    );
  }
}
