// app/api/comments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, verifyUser } from "@/lib/userAccessFunctions";
import { updateComment, deleteComment } from "@/lib/db/comments";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userOrResponse = await verifyUser(req);
    if (userOrResponse instanceof NextResponse) {
      return userOrResponse;
    }

    const { id } = await context.params;
    const body = await req.json();

    if (!body.comment) {
      return NextResponse.json(
        { error: "Comment text is required" },
        { status: 400 }
      );
    }

    const updated = await updateComment({
      id,
      user_id: userOrResponse, // numeric user id from verifyUser
      comment: body.comment
    });

    return NextResponse.json({ comment: updated }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating comment:", error.message);
    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userOrResponse = await verifyUser(req);
    if (userOrResponse instanceof NextResponse) {
      return userOrResponse;
    }
    const isAdmin = await requireAdmin(userOrResponse);
    const { id } = await context.params;

    const result = await deleteComment({
      id,
      user_id: userOrResponse,
      isAdmin
    });

    return NextResponse.json({ deleted: result }, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting comment:", error.message);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
