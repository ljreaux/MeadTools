import "server-only";

import { z } from "zod";
import prisma from "@/lib/prisma";

export const chatContextSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("recipe"), id: z.number().int().positive() }),
  z.object({ kind: z.literal("brew"), id: z.string().uuid() }),
]);

export type ChatContextSelection = z.infer<typeof chatContextSelectionSchema>;

export type ChatContextOption =
  | { kind: "recipe"; id: number; name: string }
  | {
      kind: "brew";
      id: string;
      name: string;
      stage: string;
      recipeName: string | null;
    };

/** Optional, owner-checked picker hint; full data comes from shared read tools. */
export type SelectedChatContext =
  | { kind: "recipe"; label: string; recipe: { id: number; name: string } }
  | { kind: "brew"; label: string; brew: { id: string; name: string } };

export async function getChatContextOptions(
  userId: number,
): Promise<ChatContextOption[]> {
  const [recipes, brews] = await Promise.all([
    prisma.recipes.findMany({
      where: { user_id: userId },
      orderBy: { id: "desc" },
      take: 100,
      select: { id: true, name: true },
    }),
    prisma.brews.findMany({
      where: { user_id: userId },
      orderBy: [{ end_date: "desc" }, { start_date: "asc" }],
      take: 100,
      select: {
        id: true,
        name: true,
        stage: true,
        recipes: { select: { name: true } },
      },
    }),
  ]);

  return [
    ...brews.map((brew) => ({
      kind: "brew" as const,
      id: brew.id,
      name: brew.name?.trim() || brew.recipes?.name || "Untitled brew",
      stage: brew.stage,
      recipeName: brew.recipes?.name ?? null,
    })),
    ...recipes.map((recipe) => ({
      kind: "recipe" as const,
      id: recipe.id,
      name: recipe.name.trim() || "Untitled recipe",
    })),
  ];
}

/** Validate the optional selection without loading a second account-data projection. */
export async function getSelectedChatContext(
  userId: number,
  selection: ChatContextSelection,
): Promise<SelectedChatContext | undefined> {
  if (selection.kind === "recipe") {
    const recipe = await prisma.recipes.findFirst({
      where: { id: selection.id, user_id: userId },
      select: { id: true, name: true },
    });
    if (!recipe) return undefined;
    const name = recipe.name.trim() || "Untitled recipe";
    return { kind: "recipe", label: `Recipe: ${name}`, recipe: { id: recipe.id, name } };
  }
  const brew = await prisma.brews.findFirst({
    where: { id: selection.id, user_id: userId },
    select: { id: true, name: true, recipes: { select: { name: true } } },
  });
  if (!brew) return undefined;
  const name = brew.name?.trim() || brew.recipes?.name || "Untitled brew";
  return { kind: "brew", label: `Brew: ${name}`, brew: { id: brew.id, name } };
}
