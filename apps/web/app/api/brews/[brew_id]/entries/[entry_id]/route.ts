import { verifyUser } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";
import { patchBrewEntryForApp, deleteBrewEntryForApp } from "@/lib/db/brews";
import type { PatchBrewEntryInput } from "@/lib/db/brews";
import { entryMutationError } from "@/lib/brews/entryMutationError";
import { updateBrewEntryRequestBodySchema, deleteBrewEntryRequestBodySchema } from "@meadtools/api-contract/brews";

/**
 * Update brew entry
 * @description Updates a timeline entry for a brew. Stage change entries only allow datetime and note edits.
 * @pathParams BrewEntryPathParams
 * @body UpdateBrewEntryRequestBody
 * @response 200:UpdateBrewEntryResponse
 * @responseSet none
 * @add 400:BrewEntryBadRequestErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 403:BrewInventoryErrorResponse
 * @add 404:BrewEntryNotFoundErrorResponse
 * @add 409:BrewInventoryErrorResponse
 * @add 500:BrewEntryUpdateErrorResponse
 * @auth BearerAuth
 * @tag Brews
 * @openapi
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string; entry_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const userId = userOrResponse;

  const { brew_id, entry_id } = await params;

  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }
  if (!entry_id) {
    return NextResponse.json({ error: "Missing entry_id" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateBrewEntryRequestBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid entry request" }, { status: 400 });
  try {
    const result = await patchBrewEntryForApp(userId, brew_id, entry_id, parsed.data as PatchBrewEntryInput);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const response = entryMutationError(err);
    if (response) return response;
    console.error("POST /api/brews/[brew_id]/entries/[entry_id] failed:", err);
    return NextResponse.json(
      { error: "Failed to update entry." },
      { status: 500 }
    );
  }
}

/**
 * Delete brew entry
 * @description Deletes a timeline entry for a brew. Stage change entries cannot be deleted through this endpoint.
 * @pathParams BrewEntryPathParams
 * @body DeleteBrewEntryRequestBody
 * @response 200:DeleteBrewEntrySuccessResponse
 * @responseSet none
 * @add 400:BrewEntryBadRequestErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 403:BrewInventoryErrorResponse
 * @add 404:BrewEntryNotFoundErrorResponse
 * @add 409:BrewInventoryErrorResponse
 * @add 500:BrewEntryDeleteErrorResponse
 * @auth BearerAuth
 * @tag Brews
 * @openapi
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ brew_id: string; entry_id: string }> }
) {
  const userOrResponse = await verifyUser(req);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const userId = userOrResponse;

  const { brew_id, entry_id } = await params;

  if (!brew_id) {
    return NextResponse.json({ error: "Missing brew_id" }, { status: 400 });
  }
  if (!entry_id) {
    return NextResponse.json({ error: "Missing entry_id" }, { status: 400 });
  }

  const text = await req.text();
  let body: unknown = {};
  try {
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = deleteBrewEntryRequestBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid entry request" }, { status: 400 });
  try {
    const result = await deleteBrewEntryForApp(userId, brew_id, entry_id, parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const response = entryMutationError(err);
    if (response) return response;
    console.error(
      "DELETE /api/brews/[brew_id]/entries/[entry_id] failed:",
      err
    );
    return NextResponse.json(
      { error: "Failed to delete entry." },
      { status: 500 }
    );
  }
}
