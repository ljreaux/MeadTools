import { NextRequest, NextResponse } from "next/server";
import { getAllUsers } from "@/lib/db/users";
import { requireAdmin, verifyUser } from "@/lib/userAccessFunctions";

/**
 * List users
 * @description Admin-only. Returns all MeadTools user accounts.
 * @response 200:AdminUsersResponse
 * @responseSet none
 * @add 401:AdminAuthErrorResponse
 * @add 403:AdminAuthErrorResponse
 * @add 500:AdminUsersFetchErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
export async function GET(req: NextRequest) {
  const userId = await verifyUser(req);
  if (userId instanceof NextResponse) return userId;
  const isAdmin = await requireAdmin(userId);

  if (!userId || !isAdmin) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
  }
  try {
    const users = await getAllUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
