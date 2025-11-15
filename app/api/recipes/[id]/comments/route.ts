import { createComment } from "@/lib/db/comments";
import { verifyUser } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userOrResponse = await verifyUser(req);
    if (userOrResponse instanceof NextResponse) {
      return userOrResponse;
    }

    const { id } = await context.params;
    const recipe_id = Number(id);

    if (isNaN(recipe_id)) {
      return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
    }

    const body = await req.json();
    if (!body.comment) {
      return NextResponse.json(
        { error: "Comment text is required" },
        { status: 400 }
      );
    }

    const comment = await createComment({
      recipe_id,
      user_id: userOrResponse,
      comment: body.comment,
      parent_id: body.parent_id ?? null
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding comment:", error.message);
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 }
    );
  }
}
