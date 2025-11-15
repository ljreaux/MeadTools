import { NextRequest, NextResponse } from "next/server";
import { listRootCommentsForRecipe } from "@/lib/db/comments";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const recipe_id = Number(id);

    if (Number.isNaN(recipe_id)) {
      return NextResponse.json({ error: "Invalid recipe id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor");
    const orderParam = url.searchParams.get("order");

    const limit = Math.min(Math.max(Number(limitParam ?? "20"), 1), 100); // 1..100
    const order = orderParam === "desc" ? "desc" : "asc";

    const result = await listRootCommentsForRecipe({
      recipe_id,
      limit,
      cursor: cursor ?? null,
      order
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("Failed to fetch root comments:", err?.message || err);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}
