import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { updateUser } from "@/lib/db/users";

/**
 * Set public username
 * @description Sets or updates the authenticated user's public username.
 * @body CreateUsernameRequestBody
 * @response 200:CreateUsernameSuccessResponse
 * @responseSet none
 * @add 400:CreateUsernameValidationErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:AuthenticatedRouteErrorResponse
 * @add 500:CreateUsernameFailureErrorResponse
 * @auth BearerAuth
 * @tag Account
 * @openapi
 */
export async function PATCH(req: NextRequest) {
  const userId = await verifyUser(req);

  // Unauthorized if verification fails
  if (userId instanceof NextResponse) return userId;
  const { public_username } = await req.json();

  // Validate that `public_username` is provided
  if (!public_username) {
    return NextResponse.json(
      { error: "Public username is required." },
      { status: 400 }
    );
  }

  try {
    // Update the user's public username
    const updatedUser = await updateUser(userId, { public_username });

    return NextResponse.json({
      message: "Public username successfully updated.",
      public_username: updatedUser.public_username,
    });
  } catch (error) {
    console.error("Error updating public username:", error);
    return NextResponse.json(
      { error: "Failed to update public username." },
      { status: 500 }
    );
  }
}
