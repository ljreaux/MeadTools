import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";
import {
  decodeAccountCursor,
  type AccountReadAdapter,
  type AccountReadInput,
  type AccountSensorRecord,
  type AccountHydrometerRecord,
  type SensorHistorySummary,
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

/** Identity is supplied only by authenticated application callers, never by tool arguments. */
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
      // Normalize PostgreSQL non-finite floats before Prisma decodes them.
      // A corrupt latest sample must not make the entire owned brew unreadable.
      const latestSamples = await db.$queryRaw<AccountHydrometerRecord[]>(Prisma.sql`
        SELECT to_char(l.datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS datetime,
          CASE WHEN l.gravity > '-Infinity'::float8 AND l.gravity < 'Infinity'::float8 THEN l.gravity::float8 END AS gravity,
          CASE WHEN l.calculated_gravity > '-Infinity'::float8 AND l.calculated_gravity < 'Infinity'::float8 THEN l.calculated_gravity::float8 END AS calculated_gravity,
          CASE WHEN l.temperature > '-Infinity'::float8 AND l.temperature < 'Infinity'::float8 THEN l.temperature::float8 END AS temperature,
          l.temp_units::text AS temp_units
        FROM logs l JOIN brews b ON b.id = l.brew_id
        WHERE b.user_id = ${userId} AND b.id = ${id}::uuid
        ORDER BY l.datetime DESC, l.id DESC LIMIT ${1}
      `);
      return {
        ...withBrewLink(row),
        latestHydrometerReading: latestSamples[0] ?? null,
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
    async getBrewSensorHistory(input) {
      const owned = await db.brews.findFirst({
        where: { id: input.id, user_id: userId }, select: { id: true }
      });
      if (!owned) return null;
      const position = decodeAccountCursor(input.cursor);
      // Preserve PostgreSQL timestamp precision in the continuation cursor.
      // Both queries enforce ownership; a cursor never grants account access.
      const rows = await db.$queryRaw<AccountSensorRecord[]>(Prisma.sql`
        SELECT l.id, to_char(l.datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS datetime,
          CASE WHEN l.gravity > '-Infinity'::float8 AND l.gravity < 'Infinity'::float8 THEN l.gravity::float8 END AS gravity,
          CASE WHEN l.calculated_gravity > '-Infinity'::float8 AND l.calculated_gravity < 'Infinity'::float8 THEN l.calculated_gravity::float8 END AS calculated_gravity,
          CASE WHEN l.temperature > '-Infinity'::float8 AND l.temperature < 'Infinity'::float8 THEN l.temperature::float8 END AS temperature,
          l.temp_units::text AS temp_units
        FROM logs l JOIN brews b ON b.id = l.brew_id
        WHERE b.user_id = ${userId} AND b.id = ${input.id}::uuid
          ${input.from ? Prisma.sql`AND l.datetime >= ${input.from}::timestamptz` : Prisma.empty}
          ${input.to ? Prisma.sql`AND l.datetime <= ${input.to}::timestamptz` : Prisma.empty}
          ${position ? Prisma.sql`AND (l.datetime, l.id) < (${position.at}::timestamptz, ${String(position.id)}::uuid)` : Prisma.empty}
        ORDER BY l.datetime DESC, l.id DESC LIMIT ${input.limit + 1}
      `);
      return page(rows, input.limit);
    },
    async getBrewSensorSummary(input) {
      const owned = await db.brews.findFirst({
        where: { id: input.id, user_id: userId }, select: { id: true }
      });
      if (!owned) return null;
      // Aggregate inside the database: no raw samples cross the adapter boundary.
      // The latest recorded timestamp anchors the default window, not wall-clock time.
      const rows = await db.$queryRaw<Array<{ summary: SensorHistorySummary }>>(Prisma.sql`
        WITH latest AS (
          SELECT l.datetime FROM logs l JOIN brews b ON b.id = l.brew_id
          WHERE b.user_id = ${userId} AND b.id = ${input.id}::uuid
          ORDER BY l.datetime DESC, l.id DESC LIMIT 1
        ), bounds AS (
          SELECT COALESCE(${input.from ?? null}::timestamptz, (SELECT datetime FROM latest) - INTERVAL '72 hours') AS lo,
            COALESCE(${input.to ?? null}::timestamptz, (SELECT datetime FROM latest)) AS hi
        ), samples AS (
          SELECT l.id, l.datetime,
            CASE WHEN l.gravity > '-Infinity'::float8 AND l.gravity < 'Infinity'::float8 THEN l.gravity::float8 END AS m,
            CASE WHEN l.calculated_gravity > '-Infinity'::float8 AND l.calculated_gravity < 'Infinity'::float8 THEN l.calculated_gravity::float8 END AS d,
            LAG(l.datetime) OVER (ORDER BY l.datetime, l.id) AS previous
          FROM logs l JOIN brews b ON b.id = l.brew_id CROSS JOIN bounds
          WHERE b.user_id = ${userId} AND b.id = ${input.id}::uuid
            AND l.datetime >= bounds.lo AND l.datetime <= bounds.hi
        ), stats AS (
          SELECT COUNT(*)::int AS n, MIN(datetime) AS first_at, MAX(datetime) AS last_at,
            COUNT(m)::int AS m_n, MIN(m) AS m_min, MAX(m) AS m_max,
            COUNT(d)::int AS d_n, MIN(d) AS d_min, MAX(d) AS d_max,
            MAX(EXTRACT(EPOCH FROM datetime - previous))::float8 AS max_gap,
            COUNT(*) FILTER (WHERE datetime - previous > INTERVAL '1 hour')::int AS gaps,
            COUNT(*) FILTER (WHERE datetime = previous)::int AS repeats
          FROM samples
        ), ends AS (
          SELECT (SELECT m FROM samples WHERE m IS NOT NULL ORDER BY datetime, id LIMIT 1) AS m_first,
            (SELECT m FROM samples WHERE m IS NOT NULL ORDER BY datetime DESC, id DESC LIMIT 1) AS m_last,
            (SELECT d FROM samples WHERE d IS NOT NULL ORDER BY datetime, id LIMIT 1) AS d_first,
            (SELECT d FROM samples WHERE d IS NOT NULL ORDER BY datetime DESC, id DESC LIMIT 1) AS d_last,
            (SELECT datetime FROM samples WHERE m IS NOT NULL ORDER BY datetime, id LIMIT 1) AS m_first_at,
            (SELECT datetime FROM samples WHERE m IS NOT NULL ORDER BY datetime DESC, id DESC LIMIT 1) AS m_last_at,
            (SELECT datetime FROM samples WHERE d IS NOT NULL ORDER BY datetime, id LIMIT 1) AS d_first_at,
            (SELECT datetime FROM samples WHERE d IS NOT NULL ORDER BY datetime DESC, id DESC LIMIT 1) AS d_last_at
        )
        SELECT jsonb_build_object(
          'window', jsonb_build_object(
            'from', to_char(bounds.lo AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
            'to', to_char(bounds.hi AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
            'basis', ${input.from ? "explicit" : "latest_recorded_72_hours"}::text),
          'coverage', 'all_samples_in_window', 'sampleCount', n,
          'firstSampleAt', to_char(first_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'lastSampleAt', to_char(last_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'gravityUnit', 'SG',
          'measured', jsonb_build_object('validCount', m_n, 'minimum', m_min, 'maximum', m_max,
            'firstAt', to_char(m_first_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
            'lastAt', to_char(m_last_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
            'first', m_first, 'last', m_last, 'range', m_max - m_min, 'netChange', m_last - m_first),
          'deviceCalculated', jsonb_build_object('validCount', d_n, 'minimum', d_min, 'maximum', d_max,
            'firstAt', to_char(d_first_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
            'lastAt', to_char(d_last_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
            'first', d_first, 'last', d_last, 'range', d_max - d_min, 'netChange', d_last - d_first),
          'maxGapSeconds', max_gap, 'gapsOverOneHour', gaps, 'repeatedTimestamps', repeats,
          'correctionProvenance', 'stored_device_calculation', 'stabilityAssessment', 'not_assessed'
        ) AS summary FROM bounds CROSS JOIN stats CROSS JOIN ends
      `);
      return rows[0].summary;
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
