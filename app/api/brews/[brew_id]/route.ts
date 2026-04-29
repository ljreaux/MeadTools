import {
  deleteBrewForApp,
  getBrewForApp,
  patchBrewMetadata
} from "@/lib/db/brews";
import { verifyUser } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";

/**
 * Get brew
 * @description Returns a single authenticated-user brew with entries grouped by stage.
 * @pathParams BrewPathParams
 * @response 200:BrewResponse
 * @responseSet none
 * @add 400:BrewValidationErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 500:BrewFetchErrorResponse
 * @auth BearerAuth
 * @tag Brews
 * @openapi
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const userId = userOrResponse;
  const { brew_id } = await params;

  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }

  try {
    const brew = await getBrewForApp(userId, brew_id);
    return NextResponse.json(brew, { status: 200 });
  } catch (err) {
    console.error("Error fetching brew:", err);
    return NextResponse.json(
      { error: "Failed to fetch brew." },
      { status: 500 }
    );
  }
}

/**
 * Update brew
 * @description Updates brew metadata. Setting stage to COMPLETE automatically sets end_date when one is not provided.
 * @pathParams BrewPathParams
 * @body UpdateBrewRequestBody
 * @response 200:UpdateBrewResponse
 * @responseSet none
 * @add 400:BrewValidationErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 500:BrewUpdateErrorResponse
 * @auth BearerAuth
 * @tag Brews
 * @openapi
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const userId = userOrResponse;
  const { brew_id } = await params;

  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  try {
    const updated = await patchBrewMetadata(userId, brew_id, body);
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error("Error updating brew:", err);
    return NextResponse.json(
      { error: "Failed to update brew." },
      { status: 500 }
    );
  }
}

/**
 * Delete brew
 * @description Deletes a brew owned by the authenticated user, detaches its devices, and deletes logs associated with the brew.
 * @pathParams BrewPathParams
 * @response 200:DeleteBrewSuccessResponse
 * @responseSet none
 * @add 400:BrewValidationErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 500:BrewDeleteErrorResponse
 * @auth BearerAuth
 * @tag Brews
 * @openapi
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }
  const userId = userOrResponse;

  const { brew_id } = await params; // Resolve params as Promise

  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }
  try {
    await deleteBrewForApp(brew_id, userId);
    return NextResponse.json(
      { message: "Brew deleted successfully." },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error deleting brew:", err);
    return NextResponse.json(
      { error: "Failed to delete brew." },
      { status: 500 }
    );
  }
}
