import prisma from "@/lib/prisma";
import { verifyAdmin } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";

/**
 * Get additive by ID
 * @description Returns a single additive by UUID.
 * @pathParams AdditiveByIdPathParams
 * @response 200:AdditiveByIdResponse
 * @responseSet none
 * @add 404:AdditiveNotFoundErrorResponse
 * @add 500:AdditiveFetchErrorResponse
 * @tag Additives
 * @openapi
 */
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const additive = await prisma.additives.findUnique({
      where: { id }
    });

    if (!additive) {
      return NextResponse.json(
        { error: "Additive not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(additive);
  } catch (error: any) {
    console.error("Error fetching additive:", error);
    return NextResponse.json(
      { error: "Failed to fetch additive" },
      { status: 500 }
    );
  }
}

/**
 * Update additive
 * @description Admin-only. Updates a catalog additive by UUID.
 * @pathParams AdditiveByIdPathParams
 * @body UpdateAdditiveRequestBody
 * @response 200:AdditiveResponse
 * @responseSet none
 * @add 401:AdminAuthErrorResponse
 * @add 403:AdminAuthErrorResponse
 * @add 404:AdminAuthErrorResponse
 * @add 500:UpdateAdditiveFailureErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) return adminOrResponse;

  try {
    const { id } = await params;
    const data = await req.json();

    const updated = await prisma.additives.update({
      where: { id },
      data: Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      )
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating additive:", error);
    return NextResponse.json(
      { error: "Failed to update additive" },
      { status: 500 }
    );
  }
}

/**
 * Delete additive
 * @description Admin-only. Deletes a catalog additive by UUID.
 * @pathParams AdditiveByIdPathParams
 * @response 200:DeleteAdditiveSuccessResponse
 * @responseSet none
 * @add 401:AdminAuthErrorResponse
 * @add 403:AdminAuthErrorResponse
 * @add 404:AdminAuthErrorResponse
 * @add 500:DeleteAdditiveFailureErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) return adminOrResponse;

  try {
    const { id } = await params;

    const deleted = await prisma.additives.delete({
      where: { id }
    });

    return NextResponse.json({
      message: `${deleted.name} has been deleted`
    });
  } catch (error: any) {
    console.error("Error deleting additive:", error);
    return NextResponse.json(
      { error: "Failed to delete additive" },
      { status: 500 }
    );
  }
}
