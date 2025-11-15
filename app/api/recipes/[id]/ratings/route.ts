import { setRating } from "@/lib/db/comments";
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
    if (!body.rating) {
      return NextResponse.json(
        { error: "Rating is a required field" },
        { status: 400 }
      );
    }

    const rating = await setRating({
      recipe_id,
      rating: body.rating,
      user_id: userOrResponse
    });

    return NextResponse.json({ rating }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding rating:", error.message);
    return NextResponse.json(
      { error: "Failed to add rating" },
      { status: 500 }
    );
  }
}
