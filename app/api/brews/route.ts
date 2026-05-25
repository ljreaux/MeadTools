import { verifyUser } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";
import {
  createBrewForApp,
  getBrewsForApp,
  removeDeviceFromBrew
} from "@/lib/db/brews";
import { setBrewName } from "@/lib/db/iSpindel";

/**
 * List brews
 * @description Returns the authenticated user's brew list with recipe names and latest tracking summary fields.
 * @response 200:BrewsResponse
 * @responseSet none
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:AuthenticatedRouteErrorResponse
 * @add 500:BrewFetchErrorResponse
 * @auth BearerAuth
 * @tag Brews
 * @openapi
 */
export async function GET(req: NextRequest) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const userId = userOrResponse;

  try {
    const brews = await getBrewsForApp(userId);
    return NextResponse.json({ brews }, { status: 200 });
  } catch (err) {
    console.error("GET /api/brews failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch brews." },
      { status: 500 }
    );
  }
}

/**
 * Create brew
 * @description Starts a new brew from one of the authenticated user's recipes and snapshots the current recipe data.
 * @body CreateBrewRequestBody
 * @response 201:CreateBrewResponse
 * @responseSet none
 * @add 400:BrewValidationErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:AuthenticatedRouteErrorResponse
 * @add 500:BrewCreateErrorResponse
 * @auth BearerAuth
 * @tag Brews
 * @openapi
 */
export async function POST(req: NextRequest) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const userId = userOrResponse;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.recipe_id) {
    return NextResponse.json({ error: "Missing recipe_id" }, { status: 400 });
  }

  try {
    const brew = await createBrewForApp(userId, {
      recipe_id: body.recipe_id,
      name: body?.name,
      current_volume_liters: body?.current_volume_liters
    });

    return NextResponse.json({ brew }, { status: 201 });
  } catch (err) {
    console.error("POST /api/brews failed:", err);
    return NextResponse.json(
      { error: "Failed to create brew." },
      { status: 500 }
    );
  }
}

/**
 * Update hydrometer brew
 * @description Renames a brew when brew_name is provided, otherwise detaches the device.
 * @body UpdateHydrometerBrewRequestBody
 * @response 200:UpdateHydrometerBrewResponse
 * @responseSet none
 * @add 400:HydrometerBrewValidationErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:AuthenticatedRouteErrorResponse
 * @add 500:HydrometerBrewErrorResponse
 * @auth BearerAuth
 * @tag Brews
 * @openapi
 */
export async function PATCH(req: NextRequest) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // Not verified
  }
  const userId = userOrResponse;

  const body = await req.json();
  const { device_id, brew_id, brew_name } = body as {
    device_id?: string;
    brew_id?: string;
    brew_name?: string | null;
  };

  // brew_id is ALWAYS required for both paths
  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }

  const isRename = typeof brew_name === "string" && brew_name.trim().length > 0;

  // Ending a brew requires a device_id
  if (!isRename && !device_id) {
    return NextResponse.json(
      { error: "Missing device_id for ending brew" },
      { status: 400 }
    );
  }

  try {
    let res;
    if (isRename) {
      // Rename-only path: no device required
      res = await setBrewName(brew_id, brew_name!, userId);
    } else {
      // End brew path
      res = await removeDeviceFromBrew(device_id!, brew_id, userId);
    }

    return NextResponse.json(res, { status: 200 });
  } catch (error) {
    console.error("Error updating brew:", error);
    return NextResponse.json(
      { error: "Failed to update brew." },
      { status: 500 }
    );
  }
}
