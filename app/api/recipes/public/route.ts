import { NextRequest, NextResponse } from "next/server";
import { getPublicRecipesPage } from "@/lib/db/recipes";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    // support both ?q= and ?query= just in case
    const queryParam = searchParams.get("q") ?? searchParams.get("query") ?? "";

    const page = pageParam ? Number(pageParam) : undefined;
    const limit = limitParam ? Number(limitParam) : undefined;

    const result = await getPublicRecipesPage({
      page,
      limit,
      query: queryParam || undefined
    });

    // result already looks like:
    // {
    //   recipes,
    //   totalCount,
    //   totalPages,
    //   page,
    //   limit
    // }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching public recipes (paginated):", error);
    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 500 }
    );
  }
}
