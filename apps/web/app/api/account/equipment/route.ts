import { NextRequest, NextResponse } from "next/server";
import { createEquipmentRequestBodySchema } from "@meadtools/api-contract/equipment";
import { createEquipmentService } from "@/lib/db/equipment";
import { verifyUser } from "@/lib/userAccessFunctions";
import { equipmentRouteError } from "@/lib/brews/equipmentRouteError";

const equipment = createEquipmentService();

/**
 * List account equipment
 * @description Returns retained owned equipment, vessel occupancy and ongoing owned brews. Expired premium accounts retain read access.
 * @response 200:EquipmentOverviewResponse
 * @responseSet none
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:EquipmentNotFoundErrorResponse
 * @add 500:EquipmentUnexpectedErrorResponse
 * @auth BearerAuth
 * @tag Equipment
 * @openapi
 */
export async function GET(req: NextRequest) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    return NextResponse.json(await equipment.overview(user), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return equipmentRouteError(error); }
}

/**
 * Add equipment
 * @description Creates owned equipment for a premium account. Reuse the operation ID for retries.
 * @body CreateEquipmentRequestBody
 * @response 201:EquipmentMutationResponse
 * @responseSet none
 * @add 400:EquipmentErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 403:EquipmentErrorResponse
 * @add 404:EquipmentNotFoundErrorResponse
 * @add 409:EquipmentErrorResponse
 * @add 500:EquipmentUnexpectedErrorResponse
 * @auth BearerAuth
 * @tag Equipment
 * @openapi
 */
export async function POST(req: NextRequest) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const body = await req.json().catch(() => null);
    const input = createEquipmentRequestBodySchema.parse(body);
    return NextResponse.json(await equipment.create(user, input), { status: 201 });
  } catch (error) { return equipmentRouteError(error); }
}
