import { NextRequest, NextResponse } from "next/server";
import { equipmentPathParamsSchema, updateEquipmentRequestBodySchema } from "@meadtools/api-contract/equipment";
import { createEquipmentService } from "@/lib/db/equipment";
import { verifyUser } from "@/lib/userAccessFunctions";
import { equipmentRouteError } from "@/lib/brews/equipmentRouteError";

const equipment = createEquipmentService();

/**
 * Update equipment or its vessel assignment
 * @description Premium accounts may edit equipment, archive unassigned equipment, or explicitly assign/reassign a vessel to an ongoing owned brew. Assignment requests include the expected prior brew.
 * @pathParams EquipmentPathParams
 * @body UpdateEquipmentRequestBody
 * @response 200:EquipmentMutationResponse
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
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ equipment_id: string }> }) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { equipment_id } = equipmentPathParamsSchema.parse(await params);
    const input = updateEquipmentRequestBodySchema.parse(await req.json().catch(() => null));
    return NextResponse.json(await equipment.update(user, equipment_id, input));
  } catch (error) { return equipmentRouteError(error); }
}
