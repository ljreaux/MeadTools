import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * List nutrient presets for the Other Nutrient autofill input.
 * @description Returns curated nutrient presets ordered by product name. Selecting a preset populates the existing Other nutrient inputs.
 * @response 200:NutrientPresetListResponse
 * @responseSet none
 * @add 500:NutrientPresetFetchErrorResponse
 * @tag Nutrients
 * @openapi
 */
export async function GET() {
  try {
    const presets = await prisma.nutrient_presets.findMany({
      orderBy: { name: "asc" }
    });

    return NextResponse.json(presets);
  } catch (error) {
    console.error("Failed to fetch nutrient presets:", error);
    return NextResponse.json(
      { error: "Failed to fetch nutrient presets" },
      { status: 500 }
    );
  }
}
