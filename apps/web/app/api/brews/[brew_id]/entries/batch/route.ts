import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import {
  createBrewEntryBatchRequestBodySchema,
  brewPathParamsSchema,
  brewInventoryOutcomeSchema,
} from "@meadtools/api-contract/brews";
import { createInventoryOperation } from "@/lib/db/inventory";
import { applyEntryInventoryLines } from "@/lib/db/inventory-lines";
import {
  writeCreatedBrewEntry,
  getBrewForApp,
  type CreateBrewEntryInput,
} from "@/lib/db/brews";
import { entryMutationError } from "@/lib/brews/entryMutationError";
/**
 * Log a reviewed batch of additions
 * @description Premium-only: all entries and stock deductions commit together. Retrying the same operation returns its saved result.
 * @pathParams BrewPathParams
 * @body CreateBrewEntryBatchRequestBody
 * @response 201:CreateBrewEntryResponse
 * @responseSet none
 * @add 400:BrewEntryBadRequestErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 403:BrewInventoryErrorResponse
 * @add 404:BrewEntryNotFoundErrorResponse
 * @add 409:BrewEntryConflictErrorResponse
 * @add 500:BrewEntryCreateErrorResponse
 * @auth BearerAuth
 * @tag Brews
 * @openapi
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string }> },
) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { brew_id } = brewPathParamsSchema.parse(await params);
    const body = createBrewEntryBatchRequestBodySchema.parse(
      await req.json().catch(() => null),
    );
    const inventory = await createInventoryOperation()(
      user,
      body.operation_id,
      JSON.parse(JSON.stringify({ kind: "entry_batch", brew_id, body })),
      (value) => brewInventoryOutcomeSchema.parse(value),
      async (tx, operationId) => {
        const balances = new Map();
        let deducted = false;
        for (const entry of body.entries) {
          const result = await applyEntryInventoryLines(
            tx,
            user,
            operationId,
            {
              brewId: brew_id,
              entryId: entry.client_entry_id,
              kind: "create",
              entryMutation: JSON.parse(JSON.stringify(entry)),
            },
            entry.inventory,
            async (tx) =>
              writeCreatedBrewEntry(
                tx,
                user,
                brew_id,
                entry.client_entry_id,
                entry as CreateBrewEntryInput,
              ),
          );
          if (result.status === "deducted") deducted = true;
          for (const balance of result.balances)
            balances.set(balance.stock_id, balance);
        }
        return {
          status: deducted ? ("deducted" as const) : ("untracked" as const),
          balances: Array.from(balances.values()),
        };
      },
    );
    return NextResponse.json(
      { brew: await getBrewForApp(user, brew_id), inventory },
      { status: 201 },
    );
  } catch (error) {
    const response = entryMutationError(error);
    if (response) return response;
    console.error("Batch entry write failed", error);
    return NextResponse.json(
      { error: "Failed to create entry." },
      { status: 500 },
    );
  }
}
