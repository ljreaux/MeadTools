import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { createInventoryCostService } from "@/lib/db/inventory-costs";
import { inventoryRouteError } from "@/lib/brews/inventoryRouteError";
import {
  costQueryParamsSchema,
  recipeCostPathParamsSchema,
  updateRecipeCostRequestBodySchema,
} from "@meadtools/api-contract/inventory-costs";
const costs = createInventoryCostService();
type Context = { params: Promise<{ id: string }> };
const privateHeaders = { "Cache-Control": "private, no-store" };

/**
 * Estimate recipe ingredient costs
 * @description Owners receive a planned estimate from the recipe's amounts and current inventory averages. Estimates never deduct stock. Only confident inventory matches are priced; unpriced, unmatched, ambiguous, incompatible-unit and short-stock lines are labeled, and partial totals are incomplete. With public=true, no sign-in is required and only the owner's opt-in totals are returned for a public recipe; lines, stock and prices are never public.
 * @pathParams RecipeCostPathParams
 * @queryParams CostQueryParams
 * @response 200:RecipeCostReadResponse
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
    const { id } = recipeCostPathParamsSchema.parse(await params);
    const query = costQueryParamsSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    if (query.public === "true")
      return NextResponse.json({ summary: await costs.publicRecipeSummary(Number(id)) }, { headers: privateHeaders });
    const user = await verifyUser(req);
    if (user instanceof NextResponse) return user;
    return NextResponse.json(await costs.recipeCosts(user, Number(id)), { headers: privateHeaders });
  } catch (error) {
    return inventoryRouteError(error);
  }
}

/**
 * Share a recipe cost summary
 * @description Toggles the owner's opt-in public estimate totals. Enabling requires premium; disabling is always allowed.
 * @pathParams RecipeCostPathParams
 * @body UpdateRecipeCostRequestBody
 * @response 200:RecipeCostResponse
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
export async function PATCH(req: NextRequest, { params }: Context) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { id } = recipeCostPathParamsSchema.parse(await params);
    const input = updateRecipeCostRequestBodySchema.parse(await req.json().catch(() => null));
    await costs.setShare(user, { recipeId: Number(id) }, input.share_cost_summary);
    return NextResponse.json(await costs.recipeCosts(user, Number(id)), { headers: privateHeaders });
  } catch (error) {
    return inventoryRouteError(error);
  }
}
