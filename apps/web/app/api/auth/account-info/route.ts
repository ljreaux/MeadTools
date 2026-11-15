import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { getUserById, updateUser } from "@/lib/db/users";
import { getAllRecipesForUser } from "@/lib/db/recipes";
import { updateAccountInfoRequestBodySchema } from "@meadtools/api-contract/auth";
import bcrypt from "bcrypt";

/**
 * Get account info
 * @description Returns the authenticated user's account details and saved recipes.
 * @response 200:AccountInfoResponse
 * @responseSet none
 * @add 401:AccountInfoUnauthorizedErrorResponse
 * @add 404:AccountInfoNotFoundErrorResponse
 * @add 500:AccountInfoFetchErrorResponse
 * @auth BearerAuth
 * @tag Account
 * @openapi
 */
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

/**
 * Update account info
 * @description Updates fields on the authenticated user's account. Passwords are hashed before storage.
 * @body UpdateAccountInfoRequestBody
 * @response 200:UpdateAccountInfoResponse
 * @responseSet none
 * @add 400:UpdateAccountInfoValidationErrorResponse
 * @add 401:AccountInfoUnauthorizedErrorResponse
 * @add 500:UpdateAccountInfoErrorResponse
 * @auth BearerAuth
 * @tag Account
 * @openapi
 */
export async function PATCH(req: NextRequest) {
  const userId = await verifyUser(req);

  if (!userId || userId instanceof NextResponse) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateAccountInfoRequestBodySchema.safeParse(
    await req.json().catch(() => undefined)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid account update" }, { status: 400 });
  }

  try {
    const { password, ...fields } = parsed.data;
    const updatedUser = await updateUser(
      userId,
      password === undefined
        ? fields
        : { ...fields, password: await bcrypt.hash(password, 10) }
    );

    return NextResponse.json({ ...updatedUser, password: undefined });
  } catch (error) {
    console.error("Error updating account info:", error);
    return NextResponse.json(
      { error: "Failed to update account info" },
      { status: 500 }
    );
  }
}
