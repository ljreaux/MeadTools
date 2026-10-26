import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { createInventoryOrganizationService } from "@/lib/db/inventory-organization";
import { inventoryRouteError } from "@/lib/brews/inventoryRouteError";
import {
  inventoryStockPathParamsSchema,
  updateInventoryStorageRequestBodySchema,
} from "@meadtools/api-contract/inventory";
const service = createInventoryOrganizationService();
type Context = { params: Promise<{ stock_id: string }> };
/**
 * Read storage movement history
 * @description Up to 100 retained owned position changes, including movement and automatic reductions when stock is used or corrected. Path snapshots survive location renames and archival.
 * @pathParams InventoryStockPathParams
 * @response 200:InventoryStorageHistoryResponse
 * @responseSet none
 * @add 400:InventoryStockErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:InventoryStockNotFoundResponse
 * @add 500:InventoryStockUnexpectedErrorResponse
 * @auth BearerAuth
 * @tag Inventory
 * @openapi
 */
export async function GET(req: NextRequest, { params }: Context) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { stock_id } = inventoryStockPathParamsSchema.parse(await params);
    return NextResponse.json(await service.storageHistory(user, stock_id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return inventoryRouteError(error);
  }
}
/**
 * Move stock between storage positions
 * @description Premium-only replacement of reviewed allocations without changing total stock. Unallocated quantity remains unlocated. Validates ownership, saved units, whole bottle counts, available balance and revision; all movement history and changes commit atomically with a retry receipt.
 * @pathParams InventoryStockPathParams
 * @body UpdateInventoryStorageRequestBody
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
export async function PATCH(req: NextRequest, { params }: Context) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { stock_id } = inventoryStockPathParamsSchema.parse(await params);
    return NextResponse.json(
      await service.setStorage(
        user,
        stock_id,
        updateInventoryStorageRequestBodySchema.parse(
          await req.json().catch(() => null),
        ),
      ),
    );
  } catch (error) {
    return inventoryRouteError(error);
  }
}
