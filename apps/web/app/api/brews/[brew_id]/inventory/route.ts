import { NextRequest, NextResponse } from "next/server";
import { brewInventoryPathParamsSchema } from "@meadtools/api-contract/inventory";
import { verifyUser } from "@/lib/userAccessFunctions";
import { readBrewInventory } from "@/lib/db/brew-inventory";
import { inventoryRouteError } from "@/lib/brews/inventoryRouteError";

/**
 * Read private brew inventory context
 * @description Returns owned linked deductions and the latest 50 vessel changes for active premium accounts. Includes private bottling revisions and production links for correction review. Free or expired accounts receive can_manage false and empty deduction/equipment arrays, while retaining owned bottling provenance and reconciliation warnings. This context is never included in public brew responses.
 * @pathParams BrewInventoryPathParams
 * @response 200:BrewInventoryContextResponse
 * @responseSet none
 * @add 400:InventoryStockErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:InventoryStockNotFoundResponse
 * @add 500:InventoryStockUnexpectedErrorResponse
 * @auth BearerAuth
 * @tag Inventory
 * @openapi
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string }> },
) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { brew_id } = brewInventoryPathParamsSchema.parse(await params);
    return NextResponse.json(await readBrewInventory(user, brew_id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return inventoryRouteError(error);
  }
}
