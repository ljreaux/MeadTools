import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { createFinishedMeadService } from "@/lib/db/finished-meads";
import { inventoryRouteError } from "@/lib/brews/inventoryRouteError";
import { finishedMeadPathParamsSchema, updateFinishedMeadRequestBodySchema } from "@meadtools/api-contract/inventory";

const service = createFinishedMeadService();
type Context = { params: Promise<{ mead_id: string }> };
/**
 * Read finished-mead history
 * @description Returns an owned entry and up to 100 recent quantity changes across its bottle sizes. History is retained after archival and premium expiry.
 * @pathParams FinishedMeadPathParams
 * @response 200:FinishedMeadHistoryResponse
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
    const { mead_id } = finishedMeadPathParamsSchema.parse(await params);
    return NextResponse.json(await service.history(user, mead_id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return inventoryRouteError(error); }
}
/**
 * Update finished mead or bottle counts
 * @description Premium-only details, receipt, manual use, absolute correction or archive. Mutations require the reviewed revision and stable operation UUID; conflicts never overwrite newer counts. Bottle size identifies a count, and receipt can add another size to the same entry.
 * @pathParams FinishedMeadPathParams
 * @body UpdateFinishedMeadRequestBody
 * @response 200:FinishedMeadMutationResponse
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
    const { mead_id } = finishedMeadPathParamsSchema.parse(await params);
    const input = updateFinishedMeadRequestBodySchema.parse(await req.json().catch(() => null));
    return NextResponse.json(await service.update(user, mead_id, input));
  } catch (error) { return inventoryRouteError(error); }
}
