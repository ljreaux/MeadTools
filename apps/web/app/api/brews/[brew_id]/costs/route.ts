import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { createInventoryCostService } from "@/lib/db/inventory-costs";
import { inventoryRouteError } from "@/lib/brews/inventoryRouteError";
import {
  brewCostPathParamsSchema,
  costQueryParamsSchema,
  updateBrewCostRequestBodySchema,
} from "@meadtools/api-contract/inventory-costs";
const costs = createInventoryCostService();
type Context = { params: Promise<{ brew_id: string }> };
const privateHeaders = { "Cache-Control": "private, no-store" };

/**
 * Read brew ingredient costs
 * @description Owners receive recorded costs from unit costs snapshotted when stock was deducted, plus a separately labeled planned estimate from the brew's recipe snapshot at current averages. Unpriced, unmatched and mixed-currency lines make totals incomplete; missing prices are never treated as zero. Per-liter and per-bottle values are estimates allocated by volume. With public=true, no sign-in is required and only the owner's opt-in totals are returned for a publicly readable brew; lines, stock and price history are never public.
 * @pathParams BrewCostPathParams
 * @queryParams CostQueryParams
 * @response 200:BrewCostReadResponse
 * @responseSet none
 * @add 400:InventoryStockErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:InventoryStockNotFoundResponse
 * @add 500:InventoryStockUnexpectedErrorResponse
 * @tag Inventory
 * @openapi
 */
export async function GET(req: NextRequest, { params }: Context) {
  try {
    const { brew_id } = brewCostPathParamsSchema.parse(await params);
    const query = costQueryParamsSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    if (query.public === "true")
      return NextResponse.json({ summary: await costs.publicBrewSummary(brew_id) }, { headers: privateHeaders });
    const user = await verifyUser(req);
    if (user instanceof NextResponse) return user;
    return NextResponse.json(await costs.brewCosts(user, brew_id), { headers: privateHeaders });
  } catch (error) {
    return inventoryRouteError(error);
  }
}

/**
 * Recalculate, exclude uses from, or share brew costs
 * @description recalculate is an explicit premium action that replaces every active use's cost snapshot with the stock's current average; it never changes balances and is retry-safe by operation ID. exclude_use stops or resumes counting one recorded use in this brew only (for example reused bottles); its snapshot is kept, other brews sharing the stock are unaffected, excluding requires premium and counting again is always allowed. share toggles the opt-in public cost summary; enabling requires premium, disabling is always allowed.
 * @pathParams BrewCostPathParams
 * @body UpdateBrewCostRequestBody
 * @response 200:BrewCostResponse
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
export async function POST(req: NextRequest, { params }: Context) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { brew_id } = brewCostPathParamsSchema.parse(await params);
    const input = updateBrewCostRequestBodySchema.parse(await req.json().catch(() => null));
    if (input.action === "recalculate") await costs.recalculateBrew(user, input.operation_id, brew_id);
    else if (input.action === "exclude_use") await costs.setUseExclusion(user, brew_id, input.key, input.excluded);
    else await costs.setShare(user, { brewId: brew_id }, input.share_cost_summary);
    return NextResponse.json(await costs.brewCosts(user, brew_id), { headers: privateHeaders });
  } catch (error) {
    return inventoryRouteError(error);
  }
}
