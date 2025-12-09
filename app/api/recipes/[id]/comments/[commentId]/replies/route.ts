import { NextRequest, NextResponse } from "next/server";
import { listRepliesForParent } from "@/lib/db/comments";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id, commentId } = await context.params;
    const recipe_id = Number(id);

    if (Number.isNaN(recipe_id)) {
      return NextResponse.json({ error: "Invalid recipe id" }, { status: 400 });
    }

    if (!commentId) {
      return NextResponse.json({ error: "Missing commentId" }, { status: 400 });
    }

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor");
    const orderParam = url.searchParams.get("order");

    const limit = Math.min(Math.max(Number(limitParam ?? "20"), 1), 100); // 1..100
    const order = orderParam === "desc" ? "desc" : "asc";

    const result = await listRepliesForParent({
      recipe_id,
      parent_id: commentId,
      limit,
      cursor: cursor ?? null,
      order
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("Failed to fetch comment replies:", err?.message || err);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}
