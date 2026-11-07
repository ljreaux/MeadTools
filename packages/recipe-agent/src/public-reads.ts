import { z } from "zod";
import { recipeDataV2Schema } from "@meadtools/schemas";
import {
  projectAccountRecipe,
  accountStages,
  accountTextPolicy,
} from "./account-reads";

export const PUBLIC_CANDIDATE_LIMIT = 200;
export const publicReadToolNames = [
  "search_public_recipes",
  "get_public_recipe",
  "search_public_brews",
  "get_public_brew",
  "summarize_public_brews",
] as const;
export type PublicReadName = (typeof publicReadToolNames)[number];
export const isPublicReadTool = (name: string): name is PublicReadName =>
  publicReadToolNames.some((n) => n === name);
const id = z.number().int().positive().max(2147483647);
const date = z.iso.datetime({ offset: true });
function range(minimum: number, maximum: number) {
  return z
    .strictObject({
      min: z.number().finite().min(minimum).max(maximum).optional(),
      max: z.number().finite().min(minimum).max(maximum).optional(),
    })
    .refine(
      (v) => v.min !== undefined || v.max !== undefined,
      "Supply a range endpoint",
    )
    .refine(
      (v) => v.min === undefined || v.max === undefined || v.min <= v.max,
      "Range endpoints must be ordered",
    );
}
const filters = {
  query: z.string().trim().min(1).max(160).optional(),
  recipeId: id.optional(),
  ingredientId: id.optional(),
  yeastId: id.optional(),
  estimatedAbvPercent: range(0, 100).optional(),
  originalGravitySg: range(0.8, 2).optional(),
  finalGravitySg: range(0.8, 2).optional(),
  volume: z
    .strictObject({ unit: z.enum(["L", "mL", "gal"]), range: range(0, 1e9) })
    .optional(),
};
export const publicRecipeFiltersSchema = z.strictObject(filters);
export const publicBrewFiltersSchema = z
  .strictObject({
    ...filters,
    stage: z.enum(accountStages).optional(),
    completed: z.boolean().optional(),
    startedFrom: date.optional(),
    startedTo: date.optional(),
  })
  .refine(
    (v) =>
      !v.startedFrom ||
      !v.startedTo ||
      Date.parse(v.startedFrom) <= Date.parse(v.startedTo),
    "Start date endpoints must be ordered",
  );
export type PublicFilters = z.infer<typeof publicBrewFiltersSchema>;
const cursor = z
  .string()
  .max(80)
  .regex(
    /^(?:[1-9][0-9]*|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/,
  );
const paging = {
  cursor: cursor.optional(),
  limit: z.number().int().min(1).max(20).default(10),
  sort: z.literal("id_desc").default("id_desc"),
};
const lookup = (key: z.ZodType) =>
  z
    .strictObject({ id: key.optional(), url: z.url().max(2000).optional() })
    .refine(
      (v) => (v.id !== undefined) !== (v.url !== undefined),
      "Supply exactly one ID or canonical application URL",
    );
export const publicReadInputSchemas = {
  search_public_recipes: z
    .strictObject({ filters: publicRecipeFiltersSchema.default({}), ...paging })
    .refine(
      (v) =>
        !v.cursor ||
        (/^[1-9][0-9]*$/.test(v.cursor) &&
          Number.isSafeInteger(Number(v.cursor))),
      "Invalid recipe cursor",
    ),
  search_public_brews: z
    .strictObject({ filters: publicBrewFiltersSchema.default({}), ...paging })
    .refine(
      (v) => !v.cursor || z.uuid().safeParse(v.cursor).success,
      "Invalid brew cursor",
    ),
  get_public_recipe: lookup(id),
  get_public_brew: lookup(z.uuid()),
  summarize_public_brews: z.strictObject({
    filters: publicBrewFiltersSchema.default({}),
  }),
};
const number = z.number().finite().nullable();
const estimatesSchema = z.strictObject({
  originalGravitySg: number,
  fermentationTargetFgSg: number,
  finishedGravitySg: number,
  finishedAbvPercent: number,
  bottlingVolumeLiters: number,
});
const summaryRecipeSchema = z.strictObject({
  status: z.enum(["supported", "unsupported"]),
  reason: z.enum(["missing_or_legacy", "exceeds_safe_bounds"]).nullable(),
  estimates: estimatesSchema.nullable(),
  yeastId: id.nullable(),
  ingredientIds: z.array(id).max(30),
});
const compositionSchema = z.strictObject({
  ingredients: z
    .array(
      z.strictObject({
        catalogIngredientId: id.nullable(),
        name: z.string().max(160),
        category: z.string().max(160),
        brix: z.string().max(40),
        secondary: z.boolean(),
        amounts: z.strictObject({
          basis: z.enum(["weight", "volume"]),
          weight:
            recipeDataV2Schema.shape.ingredients.element.shape.amounts.shape.weight
              .extend({ value: z.string().max(40) })
              .strict(),
          volume:
            recipeDataV2Schema.shape.ingredients.element.shape.amounts.shape.volume
              .extend({ value: z.string().max(40) })
              .strict(),
        }),
      }),
    )
    .max(30),
  additives: z
    .array(
      z.strictObject({
        name: z.string().max(160),
        amount: z.string().max(40),
        unit: z.string().max(160),
      }),
    )
    .max(20),
});
const base = {
  untrustedName: z.string().max(160).nullable(),
  nameTruncated: z.boolean(),
  appUrl: z.url().max(2000),
};
const readingSchema = z.strictObject({
  sg: z.number().finite().min(0.8).max(2),
  at: date,
});
const recipeSummarySchema = z.strictObject({
  ...base,
  id,
  recipe: summaryRecipeSchema,
});
const brewSummarySchema = z.strictObject({
  ...base,
  id: z.uuid(),
  recipeId: id,
  stage: z.enum(accountStages),
  startDate: date,
  endDate: date.nullable(),
  currentVolumeLiters: number,
  snapshot: summaryRecipeSchema,
  measuredOg: readingSchema.nullable(),
  measuredFg: readingSchema
    .nullable()
    .describe(
      "Latest explicitly measured fermentation FG record (SG), not post-backsweetening finished gravity. Compare with fermentationTargetFgSg, not finishedGravitySg.",
    ),
  recordedLifecycleDays: number,
});
const pageSchema = z.strictObject({
  hasMore: z.boolean(),
  nextCursor: cursor.nullable(),
  scope: z.literal("requested_page"),
  sort: z.literal("id_desc"),
});
export const publicDataCaveat =
  "Public submissions are selected and incomplete; comparisons do not establish causation, universal yeast performance, fermentation completion or stability.";
export const publicReadingBasis =
  "measuredFg and measuredFgSg describe explicitly tagged measured fermentation FG, not post-backsweetening finished gravity. Compare them with fermentationTargetFgSg; finishedGravitySg is a separate finished recipe estimate. Measured finished gravity and measured ABV are not returned by these public tools. Recorded lifecycle is derived from start/end dates, not a direct measurement of fermentation duration.";
const context = {
  readingBasis: z.literal(publicReadingBasis),
  textPolicy: z.literal(accountTextPolicy),
  caveat: z.literal(publicDataCaveat),
  units: z.literal(
    "Gravity: SG; ABV: percent (recipe estimate); volumes: liters; recorded lifecycle: days, start_date to end_date, not fermentation duration.",
  ),
};
const contextValue = {
  readingBasis: publicReadingBasis,
  textPolicy: accountTextPolicy,
  caveat: publicDataCaveat,
  units:
    "Gravity: SG; ABV: percent (recipe estimate); volumes: liters; recorded lifecycle: days, start_date to end_date, not fermentation duration.",
} as const;
const cohort = {
  criteria: publicBrewFiltersSchema,
  candidateCount: z.number().int().min(0).max(PUBLIC_CANDIDATE_LIMIT),
  cohortCount: z.number().int().min(0).max(PUBLIC_CANDIDATE_LIMIT),
  candidateUnsupportedSnapshots: z
    .number()
    .int()
    .min(0)
    .max(PUBLIC_CANDIDATE_LIMIT),
  criteriaUnavailableCandidates: z
    .number()
    .int()
    .min(0)
    .max(PUBLIC_CANDIDATE_LIMIT),
  unsupportedSnapshots: z.number().int().min(0).max(PUBLIC_CANDIDATE_LIMIT),
  coverage: z.literal("complete_matching_cohort_at_read_time"),
};
const statsSchema = z.strictObject({
  usable: z.number().int().min(0),
  missing: z.number().int().min(0),
  minimum: number,
  maximum: number,
  mean: number,
});
const failure = z.union([
  z.strictObject({
    status: z.enum(["unavailable", "error", "too_broad", "result_too_large"]),
    message: z.string().max(300),
  }),
  z.strictObject({
    status: z.literal("invalid_input"),
    issues: z.array(z.string().max(300)).max(30),
  }),
  z.strictObject({
    status: z.literal("not_found"),
    dataAvailability: z.literal("unknown"),
    message: z.literal("Record not found or not publicly discoverable."),
  }),
]);
const output = <T extends z.ZodType>(result: T) =>
  z.union([z.strictObject({ status: z.literal("ok"), result }), failure]);
export const publicReadOutputSchemas = {
  search_public_recipes: output(
    z.strictObject({
      ...context,
      ...cohort,
      items: z.array(recipeSummarySchema).max(20),
      page: pageSchema,
    }),
  ),
  search_public_brews: output(
    z.strictObject({
      ...context,
      ...cohort,
      items: z.array(brewSummarySchema).max(20),
      page: pageSchema,
    }),
  ),
  get_public_recipe: output(
    z.strictObject({
      ...context,
      record: recipeSummarySchema,
      composition: compositionSchema.nullable(),
    }),
  ),
  get_public_brew: output(
    z.strictObject({
      ...context,
      record: brewSummarySchema,
      snapshotComposition: compositionSchema.nullable(),
    }),
  ),
  summarize_public_brews: output(
    z.strictObject({
      ...context,
      ...cohort,
      measuredOgSg: statsSchema,
      measuredFgSg: statsSchema,
      recordedLifecycleDays: statsSchema,
    }),
  ),
};
export type PublicRecipeRecord = {
  kind: "recipe";
  id: number;
  name: string | null;
  data: unknown;
};
export type PublicBrewRecord = {
  kind: "brew";
  id: string;
  name: string | null;
  recipeId: number;
  data: unknown;
  stage: (typeof accountStages)[number];
  startDate: string;
  endDate: string | null;
  currentVolumeLiters: number | null;
  measuredOg: z.infer<typeof readingSchema> | null;
  measuredFg: z.infer<typeof readingSchema> | null;
};
export type PublicRecord = PublicRecipeRecord | PublicBrewRecord;
/** Adapter returns only currently discoverable records, in ID descending order. No identity arguments or owner adapter fallback. */
export type PublicReadAdapter = {
  origin: string;
  candidates(
    kind: PublicRecord["kind"],
    filters: PublicFilters,
  ): Promise<PublicRecord[]>;
  get(
    kind: PublicRecord["kind"],
    id: number | string,
  ): Promise<PublicRecord | null>;
};
const finite = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
function projectRecipe(data: unknown) {
  // Check raw bounds before parsing/calculating. Never expose or use notes as instructions.
  if (
    (data as { oversized?: boolean } | null)?.oversized === true ||
    new TextEncoder().encode(JSON.stringify(data) ?? "").length > 24 * 1024
  )
    return {
      summary: {
        status: "unsupported",
        reason: "exceeds_safe_bounds",
        estimates: null,
        ingredientIds: [],
        yeastId: null,
      },
      composition: null,
    } as const;
  const parsed = recipeDataV2Schema.safeParse(data);
  const projected = projectAccountRecipe(
    parsed.success
      ? { ...parsed.data, notes: { primary: [], secondary: [] } }
      : null,
  );
  if (
    projected.status !== "supported" ||
    !projected.inputs ||
    !projected.derivedEstimates ||
    !parsed.success
  )
    return {
      summary: {
        status: "unsupported",
        reason: projected.reason,
        estimates: null,
        ingredientIds: [],
        yeastId: null,
      },
      composition: null,
    } as const;
  const d = projected.derivedEstimates;
  const ingredientIds = [
    ...new Set(
      parsed.data.ingredients.flatMap((i) =>
        i.ref.kind === "catalog" &&
        id.safeParse(Number(i.ref.ingredientId)).success &&
        String(Number(i.ref.ingredientId)) === String(i.ref.ingredientId)
          ? [Number(i.ref.ingredientId)]
          : [],
      ),
    ),
  ];
  const yeastId = parsed.data.nutrients?.selected.yeastId;
  return {
    summary: {
      status: "supported",
      reason: null,
      ingredientIds,
      yeastId: id.safeParse(yeastId).success ? yeastId! : null,
      estimates: {
        originalGravitySg: finite(d.gravity.ogPrimary),
        fermentationTargetFgSg: projected.recipeTargets?.finalGravitySg ?? null,
        finishedGravitySg: finite(d.gravity.backsweetenedFg),
        finishedAbvPercent: finite(d.alcohol.abv),
        bottlingVolumeLiters: finite(d.volume.bottlingL),
      },
    },
    composition: compositionSchema.parse({
      ingredients: projected.inputs.ingredients.map((line, index) => {
        const ref = parsed.data.ingredients[index].ref;
        return {
          ...line,
          catalogIngredientId:
            ref.kind === "catalog" &&
            id.safeParse(Number(ref.ingredientId)).success
              ? Number(ref.ingredientId)
              : null,
        };
      }),
      additives: projected.inputs.additives,
    }),
  };
}
function project(row: PublicRecord, origin: string) {
  const recipe = projectRecipe(row.data);
  const name = {
    untrustedName: row.name?.slice(0, 160) ?? null,
    nameTruncated: (row.name?.length ?? 0) > 160,
  };
  if (row.kind === "recipe")
    return {
      row,
      recipe,
      summary: recipeSummarySchema.parse({
        ...name,
        id: row.id,
        appUrl: `${origin}/recipes/${row.id}`,
        recipe: recipe.summary,
      }),
    };
  const days = row.endDate
    ? (Date.parse(row.endDate) - Date.parse(row.startDate)) / 86400000
    : null;
  return {
    row,
    recipe,
    summary: brewSummarySchema.parse({
      ...name,
      id: row.id,
      recipeId: row.recipeId,
      appUrl: `${origin}/recipes/${row.recipeId}/brews/${row.id}`,
      stage: row.stage,
      startDate: row.startDate,
      endDate: row.endDate,
      currentVolumeLiters: finite(row.currentVolumeLiters),
      snapshot: recipe.summary,
      measuredOg: row.measuredOg,
      measuredFg: row.measuredFg,
      recordedLifecycleDays: days !== null && days >= 0 ? finite(days) : null,
    }),
  };
}
function inRange(
  value: number | null | undefined,
  r?: { min?: number; max?: number },
) {
  return (
    !r ||
    (value != null &&
      Number.isFinite(value) &&
      (r.min === undefined || value >= r.min) &&
      (r.max === undefined || value <= r.max))
  );
}
function matches(p: ReturnType<typeof project>, f: PublicFilters) {
  const s = p.recipe.summary,
    e = s.estimates;
  const multiplier =
    f.volume?.unit === "gal"
      ? 3.785411784
      : f.volume?.unit === "mL"
        ? 0.001
        : 1;
  return (
    (!f.ingredientId ||
      (s.ingredientIds as readonly number[]).includes(f.ingredientId)) &&
    (!f.yeastId || s.yeastId === f.yeastId) &&
    inRange(e?.originalGravitySg, f.originalGravitySg) &&
    inRange(e?.fermentationTargetFgSg, f.finalGravitySg) &&
    inRange(e?.finishedAbvPercent, f.estimatedAbvPercent) &&
    inRange(
      e?.bottlingVolumeLiters,
      f.volume
        ? {
            min:
              f.volume.range.min === undefined
                ? undefined
                : f.volume.range.min * multiplier,
            max:
              f.volume.range.max === undefined
                ? undefined
                : f.volume.range.max * multiplier,
          }
        : undefined,
    )
  );
}
function criteriaUnavailable(p: ReturnType<typeof project>, f: PublicFilters) {
  const s = p.recipe.summary,
    e = s.estimates;
  return Boolean(
    (f.ingredientId && s.status === "unsupported") ||
      (f.yeastId && s.yeastId === null) ||
      (f.originalGravitySg && e?.originalGravitySg == null) ||
      (f.finalGravitySg && e?.fermentationTargetFgSg == null) ||
      (f.estimatedAbvPercent && e?.finishedAbvPercent == null) ||
      (f.volume && e?.bottlingVolumeLiters == null),
  );
}
function statistics(values: Array<number | null>) {
  const valid = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  return {
    usable: valid.length,
    missing: values.length - valid.length,
    minimum: valid.length ? Math.min(...valid) : null,
    maximum: valid.length ? Math.max(...valid) : null,
    mean: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null,
  };
}
function linkId(
  url: string,
  kind: PublicRecord["kind"],
  origin: string,
): number | string | null {
  const u = new URL(url);
  if (
    u.origin !== new URL(origin).origin ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    return null;
  const match = u.pathname.match(
    /^(?:\/(?:en|de))?\/recipes\/([1-9][0-9]*)(?:\/brews\/([0-9a-f-]+))?\/?$/,
  );
  if (!match || (kind === "brew") !== Boolean(match[2])) return null;
  const value = kind === "recipe" ? Number(match[1]) : match[2];
  return (kind === "recipe" ? id.safeParse(value) : z.uuid().safeParse(value))
    .success
    ? value
    : null;
}
export async function executePublicReadTool(
  name: PublicReadName,
  input: unknown,
  adapter?: PublicReadAdapter,
) {
  const parsed = publicReadInputSchemas[name].safeParse(input);
  if (!parsed.success)
    return {
      status: "invalid_input" as const,
      issues: parsed.error.issues
        .slice(0, 30)
        .map((i) => `${i.path.join(".")}: ${i.message}`.slice(0, 300)),
    };
  if (!adapter)
    return {
      status: "unavailable" as const,
      message: "Public discovery is unavailable.",
    };
  try {
    const kind =
      name.endsWith("recipe") || name.endsWith("recipes") ? "recipe" : "brew";
    const args = parsed.data;
    let result: unknown;
    if ("id" in args || "url" in args) {
      const key =
        args.id ?? (args.url ? linkId(args.url, kind, adapter.origin) : null);
      if (key === null || key === undefined)
        return {
          status: "invalid_input" as const,
          issues: ["Use a canonical application link for this record type."],
        };
      const row = await adapter.get(kind, key as number | string);
      if (!row)
        return {
          status: "not_found" as const,
          dataAvailability: "unknown" as const,
          message: "Record not found or not publicly discoverable." as const,
        };
      if (
        args.url &&
        kind === "brew" &&
        row.kind === "brew" &&
        Number(new URL(args.url).pathname.match(/recipes\/([0-9]+)/)?.[1]) !==
          row.recipeId
      )
        return {
          status: "not_found" as const,
          dataAvailability: "unknown" as const,
          message: "Record not found or not publicly discoverable." as const,
        };
      const p = project(row, adapter.origin);
      result =
        kind === "recipe"
          ? {
              ...contextValue,
              record: p.summary,
              composition: p.recipe.composition,
            }
          : {
              ...contextValue,
              record: p.summary,
              snapshotComposition: p.recipe.composition,
            };
    } else {
      const f = "filters" in args ? args.filters : {};
      const rows = await adapter.candidates(kind, f);
      if (rows.length > PUBLIC_CANDIDATE_LIMIT)
        return {
          status: "too_broad" as const,
          message:
            "More than 200 metadata candidates. Narrow by name, catalog IDs, recipe ID, stage or start dates; no partial statistics were computed.",
        };
      // Defensive deduplication: one brew/recipe is one observation, regardless of joins.
      const candidates = [...new Map(rows.map((r) => [r.id, r])).values()]
        .sort((a, b) =>
          typeof a.id === "number" && typeof b.id === "number"
            ? b.id - a.id
            : String(b.id).localeCompare(String(a.id)),
        )
        .map((r) => project(r, adapter.origin));
      const matching = candidates.filter((p) => matches(p, f));
      const shared = {
        ...contextValue,
        criteria: f,
        candidateCount: candidates.length,
        cohortCount: matching.length,
        candidateUnsupportedSnapshots: candidates.filter(
          (p) => p.recipe.summary.status === "unsupported",
        ).length,
        criteriaUnavailableCandidates: candidates.filter((p) =>
          criteriaUnavailable(p, f),
        ).length,
        unsupportedSnapshots: matching.filter(
          (p) => p.recipe.summary.status === "unsupported",
        ).length,
        coverage: "complete_matching_cohort_at_read_time" as const,
      };
      if (name === "summarize_public_brews") {
        const brews = matching.map((p) => brewSummarySchema.parse(p.summary));
        result = {
          ...shared,
          measuredOgSg: statistics(brews.map((b) => b.measuredOg?.sg ?? null)),
          measuredFgSg: statistics(brews.map((b) => b.measuredFg?.sg ?? null)),
          recordedLifecycleDays: statistics(
            brews.map((b) => b.recordedLifecycleDays),
          ),
        };
      } else {
        const pagingArgs = args as z.infer<
          typeof publicReadInputSchemas.search_public_recipes
        >;
        const after = matching.filter(
          (p) =>
            !pagingArgs.cursor ||
            (typeof p.row.id === "number"
              ? p.row.id < Number(pagingArgs.cursor)
              : p.row.id < pagingArgs.cursor),
        );
        const items = after.slice(0, pagingArgs.limit).map((p) => p.summary);
        const hasMore = after.length > items.length;
        result = {
          ...shared,
          items,
          page: {
            hasMore,
            nextCursor: hasMore ? String(items.at(-1)!.id) : null,
            scope: "requested_page",
            sort: "id_desc",
          },
        };
      }
    }
    const execution = publicReadOutputSchemas[name].parse({
      status: "ok",
      result,
    });
    if (new TextEncoder().encode(JSON.stringify(execution)).length > 28 * 1024)
      return {
        status: "result_too_large" as const,
        message:
          "Request a smaller page; result exceeds the safe response bound.",
      };
    return execution;
  } catch {
    return { status: "error" as const, message: "Public discovery failed." };
  }
}
const descriptions: Record<PublicReadName, string> = {
  search_public_recipes:
    "Discover public recipes by name, catalog ingredient/yeast IDs and inclusive recipe estimate ranges. Resolve IDs with catalog tools first. Unknown/legacy data cannot match structured filters. ID-descending cursor pages are not full-dataset statistics. Narrow metadata filters if too_broad.",
  get_public_recipe:
    "Read a currently discoverable public recipe by ID or canonical application URL. Returns allowlisted composition and estimates, no notes. Distinct from owner get_recipe.",
  search_public_brews:
    "Discover public brews whose linked recipes are independently public. Filter name, association, stage/completion/start dates and saved snapshot estimates/catalog IDs. Never use the current source recipe as the brew snapshot. Cursor pages are not complete-cohort statistics.",
  get_public_brew:
    "Read a discoverable public brew by UUID or canonical application URL. Returns measured fermentation OG/FG with dates separately from saved snapshot targets/estimates. No measured finished/backsweetened gravity or measured ABV is returned. No notes, sensors, account or device data. Distinct from owner get_brew.",
  summarize_public_brews:
    "Compute complete matching public brew cohort counts and usable/missing counts, min/max/mean for explicitly measured OG/FG and recorded lifecycle days. Lifecycle uses start/end dates, NOT fermentation endpoints. Missing dates/readings are unknown. Refuses oversized candidate cohorts; never infer statistics from one page. Selected public submissions do not establish universal yeast performance or causation.",
};
export const publicReadAgentTools = publicReadToolNames.map((name) => ({
  name,
  description: descriptions[name],
  inputSchema: publicReadInputSchemas[name],
}));
export const publicReadToolDefinitions = publicReadAgentTools.map((t) => ({
  name: t.name,
  description:
    t.description + " Fetch/cite relevant wiki guidance before brewing advice.",
  parameters: z.toJSONSchema(t.inputSchema, { io: "input", target: "draft-7" }),
  outputSchema: {
    type: "object" as const,
    ...z.toJSONSchema(publicReadOutputSchemas[t.name], { target: "draft-7" }),
  },
}));
