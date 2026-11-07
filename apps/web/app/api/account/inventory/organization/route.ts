import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { createInventoryOrganizationService } from "@/lib/db/inventory-organization";
import { inventoryRouteError } from "@/lib/brews/inventoryRouteError";
import { updateInventoryOrganizationRequestBodySchema } from "@meadtools/api-contract/inventory";
const service = createInventoryOrganizationService();
/**
 * Read inventory categories and storage
 * @description Owned custom categories, nested locations, label assignments, and stock allocations. Active owners retain reads after premium expiry. Storage revisions bind changes to reviewed balances and allocations.
 * @response 200:InventoryOrganizationResponse
 * @responseSet none
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:InventoryStockNotFoundResponse
 * @add 500:InventoryStockUnexpectedErrorResponse
 * @auth BearerAuth
 * @tag Inventory
 * @openapi
 */
export async function GET(req: NextRequest) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    return NextResponse.json(await service.overview(user), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return inventoryRouteError(error);
  }
}
/**
 * Organize inventory categories and locations
 * @description Premium-only create, rename, reparent, archive or category assignment. Mutations use retry UUIDs and expected versions or label snapshots. Locations with stock or active children cannot be archived; cycles and cross-account references are rejected.
 * @body UpdateInventoryOrganizationRequestBody
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
export async function PATCH(req: NextRequest) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    return NextResponse.json(
      await service.mutate(
        user,
        updateInventoryOrganizationRequestBodySchema.parse(
          await req.json().catch(() => null),
        ),
      ),
    );
  } catch (error) {
    return inventoryRouteError(error);
  }
}
