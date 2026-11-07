import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  PUBLIC_CANDIDATE_LIMIT,
  type PublicReadAdapter,
  type PublicFilters,
  type PublicRecord,
} from "@meadtools/recipe-agent";
import prisma from "@/lib/prisma";
import { publicAppOrigin } from "@/lib/public-origin";

function metadata(f: PublicFilters, kind: "recipe" | "brew") {
  const name = kind === "recipe" ? Prisma.sql`r.name` : Prisma.sql`b.name`;
  const data =
    kind === "recipe"
      ? Prisma.sql`r."dataV2"`
      : Prisma.sql`b.recipe_snapshot->'dataV2'`;
  const ingredientRef = (ingredientId: number | string) =>
    JSON.stringify({
      ingredients: [{ ref: { kind: "catalog", ingredientId } }],
    });
  const completed = Prisma.sql`(b.stage = 'COMPLETE' OR b.end_date IS NOT NULL)`;
  return Prisma.sql`
    ${f.query ? Prisma.sql`AND strpos(lower(${name}), lower(${f.query})) > 0` : Prisma.empty}
    ${f.recipeId ? Prisma.sql`AND r.id = ${f.recipeId}` : Prisma.empty}
    ${f.ingredientId ? Prisma.sql`AND (${data} @> ${ingredientRef(f.ingredientId)}::jsonb OR ${data} @> ${ingredientRef(String(f.ingredientId))}::jsonb)` : Prisma.empty}
    ${f.yeastId ? Prisma.sql`AND ${data} @> ${JSON.stringify({ nutrients: { selected: { yeastId: f.yeastId } } })}::jsonb` : Prisma.empty}
    ${kind === "brew" && f.stage ? Prisma.sql`AND b.stage::text = ${f.stage}` : Prisma.empty}
    ${kind === "brew" && f.completed !== undefined ? Prisma.sql`AND ${completed} = ${f.completed}` : Prisma.empty}
    ${kind === "brew" && f.startedFrom ? Prisma.sql`AND b.start_date >= ${f.startedFrom}::timestamptz` : Prisma.empty}
    ${kind === "brew" && f.startedTo ? Prisma.sql`AND b.start_date <= ${f.startedTo}::timestamptz` : Prisma.empty}
  `;
}
const timestamp = (column: Prisma.Sql) =>
  Prisma.sql`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
/** Each latest reading is selected independently: at most one observation per role per brew. */
function reading(role: "OG" | "FG") {
  return Prisma.sql`(SELECT jsonb_build_object('sg', e.gravity, 'at', ${timestamp(Prisma.sql`e.datetime`)})
    FROM brew_entries e WHERE e.brew_id = b.id AND e.type = 'GRAVITY'
      AND e.data->>'source' = 'measured' AND e.data->>'readingRole' = ${role}
      AND COALESCE(e.data->>'hidden', '') <> 'true'
      AND e.gravity >= 0.8 AND e.gravity <= 2
    ORDER BY e.datetime DESC, e.id DESC LIMIT 1)`;
}
/** A fresh database snapshot per call, shared by MCP and hosted consumers. No account identity or private fallback. */
export function createPublicReadAdapter(
  db: Pick<PrismaClient, "$transaction"> = prisma,
): PublicReadAdapter {
  async function read(
    kind: "recipe" | "brew",
    f: PublicFilters,
    key?: number | string,
  ) {
    return db.$transaction(
      async (tx) => {
        // Bound scans/sorts and latest-reading lookups even on large sparse public tables.
        await tx.$executeRaw`SET LOCAL statement_timeout = '3000ms'`;
        const rows =
          kind === "recipe"
            ? await tx.$queryRaw<PublicRecord[]>(Prisma.sql`
          SELECT 'recipe' AS kind, r.id, left(r.name, 161) AS name,
            CASE WHEN octet_length(r."dataV2"::text) > 24576 THEN jsonb_build_object('oversized', true) ELSE r."dataV2" END AS data
          FROM recipes r WHERE r.private = false ${metadata(f, kind)}
            ${key !== undefined ? Prisma.sql`AND r.id = ${key}::int` : Prisma.empty}
          ORDER BY r.id DESC LIMIT ${key !== undefined ? 1 : PUBLIC_CANDIDATE_LIMIT + 1}`)
            : await tx.$queryRaw<PublicRecord[]>(Prisma.sql`
          WITH candidates AS MATERIALIZED (
            SELECT b.id FROM brews b JOIN recipes r ON r.id = b.recipe_id
            WHERE b.public = true AND r.private = false ${metadata(f, kind)}
              ${key !== undefined ? Prisma.sql`AND b.id = ${key}::uuid` : Prisma.empty}
            ORDER BY b.id DESC LIMIT ${key !== undefined ? 1 : PUBLIC_CANDIDATE_LIMIT + 1}
          )
          SELECT 'brew' AS kind, b.id, left(b.name, 161) AS name, r.id AS "recipeId", b.stage::text AS stage,
            ${timestamp(Prisma.sql`b.start_date`)} AS "startDate", ${timestamp(Prisma.sql`b.end_date`)} AS "endDate",
            CASE WHEN b.current_volume_liters > '-Infinity'::float8 AND b.current_volume_liters < 'Infinity'::float8 THEN b.current_volume_liters::float8 END AS "currentVolumeLiters",
            CASE WHEN octet_length((b.recipe_snapshot->'dataV2')::text) > 24576 THEN jsonb_build_object('oversized', true) ELSE b.recipe_snapshot->'dataV2' END AS data,
            ${reading("OG")} AS "measuredOg", ${reading("FG")} AS "measuredFg"
          FROM candidates c JOIN brews b ON b.id = c.id JOIN recipes r ON r.id = b.recipe_id
          WHERE b.public = true AND r.private = false ORDER BY b.id DESC`);
        return rows;
      },
      { timeout: 5000, maxWait: 2000 },
    );
  }
  return {
    origin: publicAppOrigin(),
    candidates: (kind, f) => read(kind, f),
    get: async (kind, key) => (await read(kind, {}, key))[0] ?? null,
  };
}
