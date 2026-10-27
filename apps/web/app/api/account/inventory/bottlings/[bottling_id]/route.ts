import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { acknowledgeBottlingChange } from "@/lib/db/bottling";
import { inventoryRouteError } from "@/lib/brews/inventoryRouteError";
import {
  inventoryBottlingPathParamsSchema,
  acknowledgeBottlingChangeRequestBodySchema,
} from "@meadtools/api-contract/inventory";
/**
 * Acknowledge a removed bottling source after physical inventory review
 * @description Premium-only acknowledgement for an owned, changed bottling whose source entry was removed. Requires a reviewed revision, retry UUID and explicit physical-count confirmation. Keeps all stock, allocations and source snapshots; never creates a receipt or restores an entry. Source changes with an existing entry must be reviewed through bottling instead.
 * @params InventoryBottlingPathParams
 * @body AcknowledgeBottlingChangeRequestBody
 * @response 200:InventoryOrganizationMutationResponse
 * @responseSet none
 * @add 400:InventoryStockErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 403:InventoryStockErrorResponse
 * @add 404:InventoryStockNotFoundResponse
 * @add 409:InventoryStockErrorResponse
 * @add 500:InventoryStockUnexpectedErrorResponse
 * @auth BearerAuth
 * @tag Inventory
 * @openapi
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ bottling_id: string }> },
) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { bottling_id } = inventoryBottlingPathParamsSchema.parse(
      await context.params,
    );
    return NextResponse.json(
      await acknowledgeBottlingChange(
        user,
        bottling_id,
        acknowledgeBottlingChangeRequestBodySchema.parse(
          await req.json().catch(() => null),
        ),
      ),
    );
  } catch (error) {
    return inventoryRouteError(error);
  }
}
