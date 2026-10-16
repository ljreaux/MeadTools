import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";
import {
  decodeAccountCursor,
  type AccountReadAdapter,
  type AccountReadInput,
  type AccountEntryRecord
} from "@meadtools/recipe-agent";
import prisma from "@/lib/prisma";
import { publicAppOrigin } from "@/lib/public-origin";

const brewSelect = {
  id: true,
  name: true,
  stage: true,
  start_date: true,
  end_date: true,
  current_volume_liters: true
} as const;
const recipeSelect = { id: true, name: true, private: true } as const;
const page = <T>(rows: T[], limit: number) => ({
  rows: rows.slice(0, limit),
  hasMore: rows.length > limit
});

/** Identity is supplied only by MCP authentication, never by tool arguments. */
export function createAccountReadAdapter(
  userId: number,
  db: Pick<PrismaClient, "brews" | "recipes" | "logs" | "$queryRaw"> = prisma
): AccountReadAdapter {
  if (!Number.isSafeInteger(userId) || userId <= 0)
    throw new Error("Authenticated account required");
  // Use the same configured origin as OAuth, never a request Host or saved text.
  // Locale-free application routes resolve through the application's i18n router.
  const origin = publicAppOrigin();
  const withBrewLink = <T extends { id: string }>(row: T) => ({
    ...row,
    appUrl: `${origin}/account/brews/${encodeURIComponent(row.id)}`
  });
  const withRecipeLink = <T extends { id: number }>(row: T) => ({
    ...row,
    appUrl: `${origin}/recipes/${row.id}`
  });

  async function entries(input: AccountReadInput<"get_brew_timeline">) {
    const position = decodeAccountCursor(input.cursor);
    // PostgreSQL keyset comparison preserves the timestamp + UUID ordering.
    // COALESCE handles absent JSON fields and SQL/JSON null without excluding legacy notes.
    return db.$queryRaw<AccountEntryRecord[]>(Prisma.sql`
      SELECT e.id, to_char(e.datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS datetime, e.type::text AS type, e.title, e.note,
        e.gravity, e.temperature, e.temp_units::text AS temp_units, e.data
      FROM brew_entries e JOIN brews b ON b.id = e.brew_id
      WHERE b.user_id = ${userId} AND b.id = ${input.id}::uuid
        AND COALESCE(e.data->>'hidden', '') <> 'true'
        AND COALESCE(e.data->>'source', '') NOT IN ('nutrient_basis', 'abv_estimate')
        ${input.from ? Prisma.sql`AND e.datetime >= ${input.from}::timestamptz` : Prisma.empty}
        ${input.to ? Prisma.sql`AND e.datetime <= ${input.to}::timestamptz` : Prisma.empty}
        ${input.types ? Prisma.sql`AND e.type::text IN (${Prisma.join(input.types)})` : Prisma.empty}
        ${position ? Prisma.sql`AND (e.datetime, e.id) < (${position.at}::timestamptz, ${String(position.id)}::uuid)` : Prisma.empty}
      ORDER BY e.datetime DESC, e.id DESC LIMIT ${input.limit + 1}
    `);
  }

  return {
    async listBrews(input) {
      const position = decodeAccountCursor(input.cursor);
      const rows = await db.brews.findMany({
        where: {
          user_id: userId,
          ...(input.query
            ? { name: { contains: input.query, mode: "insensitive" as const } }
            : {}),
          ...(input.stage ? { stage: input.stage } : {}),
          AND: [
            ...(input.activity === "active"
              ? [{ end_date: null, stage: { not: "COMPLETE" as const } }]
              : []),
            ...(input.activity === "completed"
              ? [
                  {
                    OR: [
                      { end_date: { not: null } },
                      { stage: "COMPLETE" as const }
                    ]
                  }
                ]
              : []),
            ...(position ? [{ id: { lt: String(position.id) } }] : [])
          ]
        },
        select: brewSelect,
        orderBy: { id: "desc" },
        take: input.limit + 1
      });
      return page(rows.map(withBrewLink), input.limit);
    },
    async getBrew(id) {
      const row = await db.brews.findFirst({
        where: { id, user_id: userId },
        select: { ...brewSelect, recipe_snapshot: true }
      });
      if (!row) return null;
      const readings = await Promise.all(
        (["GRAVITY", "TEMPERATURE", "PH"] as const).map((type) =>
          entries({ id, types: [type], limit: 1 })
        )
      );
      const latestHydrometerReading = await db.logs.findFirst({
        where: { brew_id: id, brews: { user_id: userId } },
        orderBy: [{ datetime: "desc" }, { id: "desc" }],
        select: {
          datetime: true,
          gravity: true,
          calculated_gravity: true,
          temperature: true,
          temp_units: true
        }
      });
      return {
        ...withBrewLink(row),
        latestHydrometerReading,
        latestReadings: readings.flatMap((rows) => rows.slice(0, 1))
      };
    },
    async getBrewTimeline(input) {
      const owned = await db.brews.findFirst({
        where: { id: input.id, user_id: userId },
        select: { id: true }
      });
      if (!owned) return null;
      return page(await entries(input), input.limit);
    },
    async listRecipes(input) {
      const position = decodeAccountCursor(input.cursor);
      const rows = await db.recipes.findMany({
        where: {
          user_id: userId,
          ...(input.query
            ? { name: { contains: input.query, mode: "insensitive" as const } }
            : {}),
          ...(position ? { id: { lt: Number(position.id) } } : {})
        },
        select: recipeSelect,
        orderBy: { id: "desc" },
        take: input.limit + 1
      });
      return page(rows.map(withRecipeLink), input.limit);
    },
    async getRecipe(id) {
      const row = await db.recipes.findFirst({
        where: { id, user_id: userId },
        select: { ...recipeSelect, dataV2: true }
      });
      return row ? withRecipeLink(row) : null;
    }
  };
}
