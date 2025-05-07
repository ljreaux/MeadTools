import { NextRequest, NextResponse } from "next/server";
import { deleteUser, getUserById, updateUser } from "@/lib/db/users";
import { requireAdmin, verifyUser } from "@/lib/userAccessFunctions";
import bcrypt from "bcrypt";
import ShortUniqueId from "short-unique-id";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyUser(req);
    if (userId instanceof NextResponse) return userId;

    const isAdmin = await requireAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }
    const { id } = await params;

    const user = await getUserById(parseInt(id, 10));
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyUser(req);
    if (userId instanceof NextResponse) return userId;
    const isAdmin = await requireAdmin(userId);

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const data = await req.json();
    let password: string | undefined;
    let hydro_token: string | undefined;
    const { randomUUID } = new ShortUniqueId();

    if (data.password) {
      password = await bcrypt.hash(data.password, 10);
    }
    if (data.updateToken) {
      hydro_token = randomUUID(10);
    }
    const updates = Object.fromEntries(
      Object.entries({ ...data, password, hydro_token }).filter(
        ([key, value]) => value !== undefined && key !== "updateToken"
      )
    );

    const updatedUser = await updateUser(Number(id), updates);
    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyUser(req);
    if (userId instanceof NextResponse) return userId;
    const isAdmin = await requireAdmin(userId);

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    const { id } = await params;

    await deleteUser(Number(id));
    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
