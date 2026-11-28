import { NextRequest, NextResponse } from "next/server";
import { recipeImagesPathParamsSchema } from "@meadtools/api-contract/brew-images";
import { recipePdfQueryParamsSchema } from "@meadtools/api-contract";
import { recipeDataV2Schema } from "@meadtools/schemas";
import prisma from "@/lib/prisma";
import { verifyUser } from "@/lib/userAccessFunctions";
import { renderSavedRecipePdf } from "@/lib/saved-recipe-pdf";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await verifyUser(req);
  if (userId instanceof NextResponse) return userId;

  const path = recipeImagesPathParamsSchema.safeParse(await params);
  const query = recipePdfQueryParamsSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!path.success || !query.success) {
    return NextResponse.json({ error: "Invalid recipe PDF request" }, { status: 400 });
  }

  try {
    const recipe = await prisma.recipes.findFirst({
      where: { id: Number(path.data.id), user_id: userId, users: { active: true } },
      select: { name: true, dataV2: true, users: { select: { public_username: true } } }
    });
    if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    const data = recipeDataV2Schema.safeParse(recipe.dataV2);
    if (!data.success) {
      return NextResponse.json({ error: "Recipe PDF is unavailable" }, { status: 422 });
    }

    const selection = data.data.nutrients?.selected;
    const yeast = selection
      ? await prisma.yeasts.findFirst({
          where: selection.yeastId != null ? { id: selection.yeastId } : { name: selection.yeastStrain },
          select: { name: true, low_temp: true, high_temp: true, tolerance: true }
        })
      : null;
    const pdf = await renderSavedRecipePdf({
      data: data.data,
      title: recipe.name,
      publicUsername: recipe.users?.public_username ?? "",
      locale: query.data.locale,
      yeast: yeast ? { ...yeast, name: selection?.yeastStrain || yeast.name } : undefined
    });
    return NextResponse.json(pdf, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not render recipe PDF", error);
    return NextResponse.json({ error: "Could not generate recipe PDF" }, { status: 500 });
  }
}
