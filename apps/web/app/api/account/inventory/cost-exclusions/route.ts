import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { createInventoryCostService } from "@/lib/db/inventory-costs";
import { inventoryRouteError } from "@/lib/brews/inventoryRouteError";
import { updateInventoryCostExclusionsRequestBodySchema } from "@meadtools/api-contract/inventory-costs";
const costs = createInventoryCostService();
const privateHeaders = { "Cache-Control": "private, no-store" };

/**
 * List ingredients not costed
 * @description Returns the owner's account-wide "don't track cost" choices. Active accounts retain read access after premium expiry.
 * @response 200:InventoryCostExclusionsResponse
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
    return NextResponse.json(await costs.listExclusions(user), { headers: privateHeaders });
  } catch (error) {
    return inventoryRouteError(error);
  }
}

/**
 * Stop or resume costing an ingredient
 * @description exclude marks an ingredient (for example tap water), by exact normalized line name and optional catalog identity, as never costed in any recipe estimate or brew. It never matches by stock item; per-batch choices such as reused bottles use the brew's exclude_use action. Excluded lines are never costed, even when priced, and never make totals incomplete. Exclusions apply when costs are read, so they also cover uses recorded earlier; include restores those uses' saved snapshots. Excluding requires premium and is idempotent; include is always allowed.
 * @body UpdateInventoryCostExclusionsRequestBody
 * @response 200:InventoryCostExclusionsResponse
 * @responseSet none
 * @add 400:InventoryStockErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 403:InventoryStockErrorResponse
 * @add 404:InventoryStockNotFoundResponse
 * @add 500:InventoryStockUnexpectedErrorResponse
 * @auth BearerAuth
 * @tag Inventory
 * @openapi
 */
export async function PATCH(req: NextRequest) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const input = updateInventoryCostExclusionsRequestBodySchema.parse(await req.json().catch(() => null));
    return NextResponse.json(await costs.updateExclusions(user, input), { headers: privateHeaders });
  } catch (error) {
    return inventoryRouteError(error);
  }
}
