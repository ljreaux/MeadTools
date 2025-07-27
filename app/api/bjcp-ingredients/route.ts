import { createIngredient, getIngredients } from "@/lib/db/bjcp-ingredients";
import { verifyAdmin } from "@/lib/userAccessFunctions";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const ingredients = await getIngredients();

    return new NextResponse(JSON.stringify(ingredients), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Change "*" to your domain if needed
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Error fetching ingredients:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to fetch ingredients" }),
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
}

export async function POST(req: NextRequest) {
  // Check for admin privileges
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) {
    return adminOrResponse;
  }

  try {
    const body = await req.json();
    const newIngredient = await createIngredient(body);

    return NextResponse.json(newIngredient, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create ingredient" },
      { status: 500 }
    );
  }
}
