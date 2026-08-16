import "server-only";

import { recipeDataV2Schema, type RecipeDataV2 } from "@meadtools/schemas";
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

export type SelectedChatContext =
  | {
      kind: "recipe";
      label: string;
      recipe: { id: number; name: string; dataV2: RecipeDataV2 };
    }
  | {
      kind: "brew";
      label: string;
      brew: {
        id: string;
        name: string;
        stage: string;
        startDate: string;
        endDate: string | null;
        currentVolumeLiters: number | null;
        latestGravity: number | null;
        recipeName: string | null;
        recipeSnapshot: { name: string; dataV2: RecipeDataV2 } | null;
        recentEntries: Array<{
          datetime: string;
          type: string;
          title: string | null;
          gravity: number | null;
          temperature: number | null;
          temperatureUnit: string | null;
          untrustedNote: string | null;
        }>;
      };
    };

const maxNoteLength = 500;

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

/**
 * Loads only the record explicitly selected by the current authenticated user.
 * This DTO intentionally avoids account data, device credentials, and raw
 * arbitrary entry payloads. Freeform notes remain clearly marked as untrusted
 * reference data for the model.
 */
export async function getSelectedChatContext(
  userId: number,
  selection: ChatContextSelection,
): Promise<SelectedChatContext | undefined> {
  if (selection.kind === "recipe") {
    const recipe = await prisma.recipes.findFirst({
      where: { id: selection.id, user_id: userId },
      select: { id: true, name: true, dataV2: true },
    });
    if (!recipe) return undefined;

    const parsed = recipeDataV2Schema.safeParse(recipe.dataV2);
    if (!parsed.success) return undefined;
    const name = recipe.name.trim() || "Untitled recipe";
    return {
      kind: "recipe",
      label: `Recipe: ${name}`,
      recipe: { id: recipe.id, name, dataV2: parsed.data },
    };
  }

  const brew = await prisma.brews.findFirst({
    where: { id: selection.id, user_id: userId },
    select: {
      id: true,
      name: true,
      stage: true,
      start_date: true,
      end_date: true,
      current_volume_liters: true,
      latest_gravity: true,
      recipe_snapshot: true,
      recipes: { select: { name: true } },
      entries: {
        orderBy: { datetime: "desc" },
        take: 12,
        select: {
          datetime: true,
          type: true,
          title: true,
          note: true,
          gravity: true,
          temperature: true,
          temp_units: true,
        },
      },
    },
  });
  if (!brew) return undefined;

  const snapshot = recipeSnapshotFromJson(brew.recipe_snapshot);
  const name = brew.name?.trim() || brew.recipes?.name || "Untitled brew";
  return {
    kind: "brew",
    label: `Brew: ${name}`,
    brew: {
      id: brew.id,
      name,
      stage: brew.stage,
      startDate: brew.start_date.toISOString(),
      endDate: brew.end_date?.toISOString() ?? null,
      currentVolumeLiters: numberOrNull(brew.current_volume_liters),
      latestGravity: numberOrNull(brew.latest_gravity),
      recipeName: brew.recipes?.name ?? null,
      recipeSnapshot: snapshot,
      recentEntries: brew.entries.map((entry) => ({
        datetime: entry.datetime.toISOString(),
        type: entry.type,
        title: entry.title,
        gravity: numberOrNull(entry.gravity),
        temperature: numberOrNull(entry.temperature),
        temperatureUnit: entry.temp_units,
        untrustedNote: truncateUntrustedNote(entry.note),
      })),
    },
  };
}

function recipeSnapshotFromJson(
  value: unknown,
): { name: string; dataV2: RecipeDataV2 } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as { name?: unknown; dataV2?: unknown };
  if (typeof snapshot.name !== "string") return null;
  const parsed = recipeDataV2Schema.safeParse(snapshot.dataV2);
  if (!parsed.success) return null;
  return { name: snapshot.name, dataV2: parsed.data };
}

function numberOrNull(
  value: { toString(): string } | number | null,
): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function truncateUntrustedNote(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxNoteLength);
}
