import { NextRequest, NextResponse } from "next/server";
import { getYeastById, updateYeast, deleteYeast } from "@/lib/db/yeasts";
import { verifyAdmin } from "@/lib/userAccessFunctions";

// GET /api/yeasts/:id
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const yeast = await getYeastById(Number(id));
    return NextResponse.json(yeast);
  } catch (error: any) {
    console.error("Error fetching yeast by ID:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch yeast by ID" },
      { status: 500 }
    );
  }
}

// PATCH /api/yeasts/:id - Admin-only route
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) {
    return adminOrResponse;
  }

  try {
    const updateData = await req.json();
    const { id } = await params;
    const updatedYeast = await updateYeast(id, updateData);
    return NextResponse.json(updatedYeast);
  } catch (error: any) {
    console.error("Error updating yeast:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update yeast" },
      { status: 500 }
    );
  }
}

// DELETE /api/yeasts/:id - Admin-only route
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) {
    return adminOrResponse;
  }

  try {
    const { id } = await params;
    const deletedYeast = await deleteYeast(id);
    return NextResponse.json({
      message: `${deletedYeast.name} has been deleted.`
    });
  } catch (error: any) {
    console.error("Error deleting yeast:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete yeast" },
      { status: 500 }
    );
  }
}
