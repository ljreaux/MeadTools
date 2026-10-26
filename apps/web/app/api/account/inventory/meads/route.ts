import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { createFinishedMeadService } from "@/lib/db/finished-meads";
import { inventoryRouteError } from "@/lib/brews/inventoryRouteError";
import { createFinishedMeadRequestBodySchema } from "@meadtools/api-contract/inventory";

const service = createFinishedMeadService();
/**
 * List finished meads
 * @description Returns owned finished-mead entries with bottle counts by size. Active accounts retain read-only access after premium expiry.
 * @response 200:FinishedMeadOverviewResponse
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
    return NextResponse.json(await service.overview(user), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return inventoryRouteError(error); }
}
/**
 * Add a finished mead
 * @description Creates a user-named entry with one or more bottle sizes and atomic initial quantity history. Requires premium and a stable operation UUID for retries. No brew or lot is required.
 * @body CreateFinishedMeadRequestBody
 * @response 201:FinishedMeadMutationResponse
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
export async function POST(req: NextRequest) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const input = createFinishedMeadRequestBodySchema.parse(await req.json().catch(() => null));
    return NextResponse.json(await service.create(user, input.operation_id, input.mead), { status: 201 });
  } catch (error) { return inventoryRouteError(error); }
}
