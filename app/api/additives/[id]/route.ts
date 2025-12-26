import prisma from "@/lib/prisma";
import { verifyAdmin } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";

// GET /api/additives/:id
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

// PATCH /api/additives/:id
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

// DELETE /api/additives/:id
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
