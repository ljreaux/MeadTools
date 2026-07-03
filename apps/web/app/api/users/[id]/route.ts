import { NextRequest, NextResponse } from "next/server";
import { deleteUser, getUserById, updateUser } from "@/lib/db/users";
import { requireAdmin, verifyUser } from "@/lib/userAccessFunctions";
import bcrypt from "bcrypt";
import ShortUniqueId from "short-unique-id";

/**
 * Get user
 * @description Admin-only. Returns an active MeadTools user by numeric ID.
 * @pathParams AdminUserPathParams
 * @response 200:AdminUserResponse
 * @responseSet none
 * @add 401:AdminAuthErrorResponse
 * @add 403:AdminAuthErrorResponse
 * @add 404:AdminUserNotFoundErrorResponse
 * @add 500:AdminUserFetchErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
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

/**
 * Update user
 * @description Admin-only. Updates account fields for a MeadTools user. Set updateToken to generate a new hydrometer token.
 * @pathParams AdminUserPathParams
 * @body UpdateAdminUserRequestBody
 * @response 200:AdminUserResponse
 * @responseSet none
 * @add 401:AdminAuthErrorResponse
 * @add 403:AdminAuthErrorResponse
 * @add 404:AdminAuthErrorResponse
 * @add 500:AdminUserUpdateErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
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

/**
 * Delete user
 * @description Admin-only. Soft-deletes a MeadTools user by setting active to false.
 * @pathParams AdminUserPathParams
 * @response 200:DeleteAdminUserSuccessResponse
 * @responseSet none
 * @add 401:AdminAuthErrorResponse
 * @add 403:AdminAuthErrorResponse
 * @add 404:AdminAuthErrorResponse
 * @add 500:AdminUserDeleteErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
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
