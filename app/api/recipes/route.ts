import { NextRequest, NextResponse } from "next/server";
import { createRecipe } from "@/lib/db/recipes";
import { requireAdmin, verifyUser } from "@/lib/userAccessFunctions";
import { getAdminRecipesPage } from "@/lib/db/recipes";
import { isRecipeDataV2, RecipeDataV2 } from "@/types/recipeDataV2";

export async function GET(req: NextRequest) {
  try {
    const userOrResponse = await verifyUser(req);
    if (userOrResponse instanceof NextResponse) {
      // Not logged in / invalid token, etc.
      return userOrResponse;
    }

    const isAdmin = await requireAdmin(userOrResponse);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden – admin access required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");
    const query = searchParams.get("query") ?? "";

    const result = await getAdminRecipesPage({ page, limit, query });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching recipes (admin):", error);
    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userOrResponse = await verifyUser(req);
    if (userOrResponse instanceof NextResponse) return userOrResponse;

    const body = await req.json();

    const {
      name,

      // legacy
      recipeData,
      yanFromSource,
      yanContribution,
      nutrientData,
      advanced,
      nuteInfo,
      primaryNotes,
      secondaryNotes,

      // ✅ new
      dataV2,

      private: privateRecipe,
      lastActivityEmailAt,
      activityEmailsEnabled
    }: {
      name?: string;

      recipeData?: string;
      yanFromSource?: string | null;
      yanContribution?: string;
      nutrientData?: string;
      advanced?: boolean;
      nuteInfo?: string | null;
      primaryNotes?: string[];
      secondaryNotes?: string[];

      dataV2?: RecipeDataV2;

      private?: boolean;
      lastActivityEmailAt?: string | null;
      activityEmailsEnabled?: boolean;
    } = body;

    // ✅ during migration: allow either old or new payload
    if (!name || (!recipeData && !dataV2)) {
      return NextResponse.json(
        { error: "Name and recipe data are required." },
        { status: 400 }
      );
    }

    // Optional: enforce valid v2 shape if present
    if (dataV2 && !isRecipeDataV2(dataV2)) {
      return NextResponse.json(
        { error: "Invalid dataV2 payload." },
        { status: 400 }
      );
    }

    const recipe = await createRecipe({
      userId: userOrResponse,
      name,

      // legacy (still required if your DB columns are non-nullable)
      recipeData: recipeData ?? "",
      yanFromSource: yanFromSource ?? null,
      yanContribution: yanContribution ?? "",
      nutrientData: nutrientData ?? "",
      advanced: advanced ?? false,
      nuteInfo: nuteInfo ?? null,
      primaryNotes: primaryNotes ?? [],
      secondaryNotes: secondaryNotes ?? [],

      // ✅ new
      dataV2: dataV2,

      private: privateRecipe ?? false,
      activityEmailsEnabled: activityEmailsEnabled ?? false,
      lastActivityEmailAt: lastActivityEmailAt
        ? new Date(lastActivityEmailAt)
        : null
    });

    return NextResponse.json({ recipe }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating recipe:", error?.message ?? error);
    return NextResponse.json(
      { error: "Failed to create recipe" },
      { status: 500 }
    );
  }
}
