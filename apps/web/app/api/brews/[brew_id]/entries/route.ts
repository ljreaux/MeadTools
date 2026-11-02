import { createBrewEntryForApp } from "@/lib/db/brews";
import { BrewEntryIdConflictError } from "@/lib/brews/createBrewEntryIdempotently";
import { entryMutationError } from "@/lib/brews/entryMutationError";
import type { CreateBrewEntryInput } from "@/lib/db/brews";
import { verifyUser } from "@/lib/userAccessFunctions";
import { createBrewEntryRequestBodySchema } from "@meadtools/api-contract/brews";
import { NextRequest, NextResponse } from "next/server";

/**
 * Create brew entry
 * @description Adds a timeline entry to a brew. STAGE_CHANGE entries are handled by updating the brew stage and return the refreshed brew.
 * @pathParams BrewPathParams
 * @body CreateBrewEntryRequestBody
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
  { params }: { params: Promise<{ brew_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const userId = userOrResponse;

  const { brew_id } = await params;
  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (
    body.client_entry_id !== undefined &&
    !createBrewEntryRequestBodySchema.shape.client_entry_id.safeParse(
      body.client_entry_id
    ).success
  ) {
    return NextResponse.json(
      { error: "Invalid client_entry_id" },
      { status: 400 }
    );
  }

  const parsed = createBrewEntryRequestBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid entry request" }, { status: 400 });
  try {
    const result = await createBrewEntryForApp(userId, brew_id, parsed.data as CreateBrewEntryInput);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof BrewEntryIdConflictError) {
      return NextResponse.json(
        { error: "Entry ID is already in use" },
        { status: 409 }
      );
    }
    const response = entryMutationError(err);
    if (response) return response;
    console.error("Error creating entry:", err);
    return NextResponse.json(
      { error: "Failed to create entry." },
      { status: 500 }
    );
  }
}
