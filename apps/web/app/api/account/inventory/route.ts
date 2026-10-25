import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { createInventoryService } from "@/lib/db/inventory";
import { createInventoryAccountReader } from "@/lib/db/inventory-account";
import { inventoryRouteError } from "@/lib/brews/inventoryRouteError";
import { createInventoryStockRequestBodySchema } from "@meadtools/api-contract/inventory";
const service = createInventoryService();
const reader = createInventoryAccountReader();
/**
 * List inventory stock
 * @description Returns only authenticated owned stock. Active accounts retain read access after premium expiry.
 * @response 200:InventoryOverviewResponse
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
  try { return NextResponse.json(await reader.overview(user), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return inventoryRouteError(error); }
}

/**
 * Add inventory stock
 * @description Premium mutations retain balances and immutable adjustment history, with account-scoped operation IDs for safe retries.
 * @body CreateInventoryStockRequestBody
 * @response 201:InventoryStockMutationResponse
 * @responseSet none
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:InventoryStockNotFoundResponse
 * @add 500:InventoryStockUnexpectedErrorResponse
 * @add 400:InventoryStockErrorResponse
 * @add 403:InventoryStockErrorResponse
 * @add 409:InventoryStockErrorResponse
 * @auth BearerAuth
 * @tag Inventory
 * @openapi
 */
export async function POST(req: NextRequest) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const input = createInventoryStockRequestBodySchema.parse(await req.json().catch(() => null));
    return NextResponse.json(await service.createStock(user, input.operation_id, input.stock), { status: 201 });
  } catch (error) { return inventoryRouteError(error); }
}
