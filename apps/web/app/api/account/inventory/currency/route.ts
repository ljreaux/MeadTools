import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { createInventoryCostService } from "@/lib/db/inventory-costs";
import { inventoryRouteError } from "@/lib/brews/inventoryRouteError";
import { updateInventoryCurrencyRequestBodySchema } from "@meadtools/api-contract/inventory";
const costs = createInventoryCostService();

/**
 * Choose the inventory currency
 * @description Premium owners choose one ISO 4217 currency for new inventory prices. Prices in other currencies are rejected; there is no conversion. Existing unit costs keep their recorded currency, and totals that mix currencies are reported as incomplete.
 * @body UpdateInventoryCurrencyRequestBody
 * @response 200:InventoryCurrencyResponse
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
export async function PUT(req: NextRequest) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const input = updateInventoryCurrencyRequestBodySchema.parse(await req.json().catch(() => null));
    return NextResponse.json(await costs.setCurrency(user, input.currency));
  } catch (error) {
    return inventoryRouteError(error);
  }
}
