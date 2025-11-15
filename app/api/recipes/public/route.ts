import { NextResponse } from "next/server";
import { getPublicRecipes } from "@/lib/db/recipes";

export async function GET() {
  try {
    const recipes = await getPublicRecipes();
    return NextResponse.json({ recipes }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching public recipes:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 500 }
    );
  }
}
