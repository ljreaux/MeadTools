import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { createInventoryService } from "@/lib/db/inventory";
import { createInventoryAccountReader } from "@/lib/db/inventory-account";
import { inventoryRouteError } from "@/lib/brews/inventoryRouteError";
import { inventoryStockPathParamsSchema, updateInventoryStockRequestBodySchema } from "@meadtools/api-contract/inventory";
const service = createInventoryService();
const reader = createInventoryAccountReader();
type Context = { params: Promise<{ stock_id: string }> };
/**
 * Read recent stock history
 * @description Returns only authenticated owned stock. Active accounts retain read access after premium expiry.
 * @pathParams InventoryStockPathParams
 * @response 200:InventoryStockHistoryResponse
 * @responseSet none
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:InventoryStockNotFoundResponse
 * @add 500:InventoryStockUnexpectedErrorResponse
 * @add 400:InventoryStockErrorResponse
 * @auth BearerAuth
 * @tag Inventory
 * @openapi
 */
export async function GET(req: NextRequest, { params }: Context) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { stock_id } = inventoryStockPathParamsSchema.parse(await params);
    return NextResponse.json(await reader.history(user, stock_id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return inventoryRouteError(error); }
}

/**
 * Adjust or archive inventory stock
 * @description Premium mutations retain balances and immutable adjustment history, with account-scoped operation IDs for safe retries.
 * @pathParams InventoryStockPathParams
 * @body UpdateInventoryStockRequestBody
 * @response 200:InventoryStockMutationResponse
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
export async function PATCH(req: NextRequest, { params }: Context) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { stock_id } = inventoryStockPathParamsSchema.parse(await params);
    const input = updateInventoryStockRequestBodySchema.parse(await req.json().catch(() => null));
    const result = input.action === "archive" ? await service.archiveStock(user, input.operation_id, stock_id) :
      await service.changeStock(user, input.operation_id, { stockId: stock_id, kind: input.action,
        quantity: input.quantity, note: input.note, expectedBalance: input.expected_balance });
    return NextResponse.json(result);
  } catch (error) { return inventoryRouteError(error); }
}
