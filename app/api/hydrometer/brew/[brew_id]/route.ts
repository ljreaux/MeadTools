import { verifyUser } from "@/lib/userAccessFunctions";
import {
  addRecipeToBrew,
  deleteBrew,
  receiveBrewAlerts,
} from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

/**
 * Link recipe or alert settings to hydrometer brew
 * @description Links one of the authenticated user's recipes to a hydrometer brew, or updates email-alert preference when recipe_id is omitted.
 * @pathParams BrewPathParams
 * @body LinkRecipeToHydrometerBrewRequestBody
 * @response 200:UpdateHydrometerBrewRecipeOrAlertsResponse
 * @responseSet none
 * @add 400:HydrometerBrewValidationErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 500:HydrometerBrewErrorResponse
 * @auth BearerAuth
 * @tag Hydrometer
 * @openapi
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Return error response if the user is not verified
  }
  const userId = userOrResponse;

  const { brew_id } = await params; // Resolve params as Promise
  const body = await req.json();
  const { recipe_id, requested_email_alerts } = body;

  if (brew_id && !recipe_id) {
    await receiveBrewAlerts(brew_id, requested_email_alerts);
    return NextResponse.json(
      { message: `Brew ${brew_id} will now receive email alerts.` },
      { status: 200 }
    );
  }

  if (!brew_id || !recipe_id) {
    return NextResponse.json(
      { error: "Missing brew_id or recipe_id" },
      { status: 400 }
    );
  }
  try {
    const updatedBrew = await addRecipeToBrew(recipe_id, brew_id, userId);
    if (!updatedBrew) {
      throw new Error("Failed to update brew.");
    }
    return NextResponse.json(updatedBrew, { status: 200 });
  } catch (err) {
    console.error("Error updating brew:", err);
    return NextResponse.json(
      { error: "Failed to update brew." },
      { status: 500 }
    );
  }
}

/**
 * Delete hydrometer brew
 * @description Deletes a hydrometer brew owned by the authenticated user and removes its associated logs.
 * @pathParams BrewPathParams
 * @response 200:DeleteHydrometerBrewResponse
 * @responseSet none
 * @add 400:HydrometerBrewValidationErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 500:HydrometerBrewErrorResponse
 * @auth BearerAuth
 * @tag Hydrometer
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
    await deleteBrew(brew_id, userId);
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
