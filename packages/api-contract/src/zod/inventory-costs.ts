import { z } from "zod";
import { catalogReferenceSchema, quantitySchema, quantityUnitSchema } from "@meadtools/inventory-domain";

const moneySchema = z.object({
  currency: z.string().length(3),
  amount: z.number().nonnegative(),
});

/** One costed line. Private: it reveals the owner's stock and unit costs. */
export const inventoryCostLineSchema = z.object({
  key: z.string(),
  name: z.string(),
  quantity: quantitySchema.nullable(),
  stock_id: z.string().uuid().nullable(),
  stock_name: z.string().nullable(),
  /** excluded: the owner chose not to track this ingredient's cost. */
  status: z.enum(["priced", "unpriced", "unmatched", "ambiguous", "incompatible", "excluded"]),
  unit_cost: z.number().nonnegative().nullable(),
  unit: quantityUnitSchema.nullable(),
  currency: z.string().length(3).nullable(),
  cost: z.number().nonnegative().nullable(),
  /** Recorded uses only: when the unit cost was snapshotted. */
  costed_at: z.string().datetime().nullable().default(null),
  /** Estimates only: amount needed beyond matched stock on hand, in the stock unit. */
  shortage: quantitySchema.nullable().default(null),
  /** Identity used to exclude or re-include this ingredient. */
  catalog_reference: catalogReferenceSchema.nullable().default(null),
  /**
   * Why an excluded line is not costed: `use` for this recorded use only
   * (e.g. reused bottles in one brew), `ingredient` for an account-wide choice.
   */
  exclusion: z.enum(["use", "ingredient"]).nullable().default(null),
  /** Entry line kind, e.g. INGREDIENT, NUTRIENT or PACKAGING. */
  kind: z.string().nullable().default(null),
});

const summaryFields = {
  /** One total per currency; amounts are never added across currencies. */
  totals: z.array(moneySchema),
  /** False whenever a line is unpriced/unmatched or currencies are mixed. */
  complete: z.boolean(),
  mixed_currencies: z.boolean(),
  /** Estimated from the stated volume; null without one priced currency. */
  per_liter: z.number().nonnegative().nullable(),
  volume_liters: z.number().positive().nullable(),
};

export const inventoryCostSummarySchema = z.object({
  ...summaryFields,
  basis: z.enum(["recipe_estimate", "recorded_usage"]),
  lines: z.array(inventoryCostLineSchema),
  /** Estimate lines whose matched stock has less on hand than planned. */
  short_lines: z.number().int().nonnegative().default(0),
  /** Lines the owner chose not to cost; they never make a total incomplete. */
  excluded_lines: z.number().int().nonnegative().default(0),
  missing: z.object({
    unpriced: z.number().int().nonnegative(),
    unmatched: z.number().int().nonnegative(),
    ambiguous: z.number().int().nonnegative(),
    incompatible: z.number().int().nonnegative(),
  }),
});

export const inventoryBottleCostSchema = z.object({
  size_liters: z.number().positive(),
  count: z.number().int().positive(),
  amount: z.number().nonnegative(),
});

/** Recorded costs plus a separately labeled plan from the recipe snapshot. */
export const brewCostResponseSchema = z.object({
  can_manage: z.boolean(),
  share_cost_summary: z.boolean(),
  recorded: inventoryCostSummarySchema.extend({
    volume_source: z.enum(["bottled", "current", "recipe"]).nullable(),
    per_bottle: z.array(inventoryBottleCostSchema).nullable(),
  }),
  planned: inventoryCostSummarySchema.nullable(),
});

export const recipeCostResponseSchema = z.object({
  can_manage: z.boolean(),
  share_cost_summary: z.boolean(),
  estimate: inventoryCostSummarySchema,
});

/** Opt-in public summary. Never includes lines, stock, unit costs or history. */
export const publicCostSummarySchema = z.object({
  ...summaryFields,
  basis: z.enum(["recipe_estimate", "recorded_usage"]),
  per_bottle: z.array(inventoryBottleCostSchema).nullable().default(null),
});
export const publicCostSummaryResponseSchema = z.object({
  summary: publicCostSummarySchema.nullable(),
});

/** Owner reads return full detail; public=true returns only opt-in totals. */
export const brewCostReadResponseSchema = z.union([brewCostResponseSchema, publicCostSummaryResponseSchema]);
export const recipeCostReadResponseSchema = z.union([recipeCostResponseSchema, publicCostSummaryResponseSchema]);

export const updateBrewCostRequestBodySchema = z.discriminatedUnion("action", [
  z
    .object({
      /** Explicitly replaces every active use's snapshot with current averages. */
      action: z.literal("recalculate"),
      operation_id: z.string().uuid(),
    })
    .strict(),
  z
    .object({ action: z.literal("share"), share_cost_summary: z.boolean() })
    .strict(),
  z
    .object({
      /** Count or stop counting one recorded use in this brew only. */
      action: z.literal("exclude_use"),
      /** The cost line key: "{entry_id}/{line_key}". */
      key: z.string().regex(/^[0-9a-f-]{36}\/[^/]{1,200}$/i),
      excluded: z.boolean(),
    })
    .strict(),
]);
export const updateRecipeCostRequestBodySchema = z
  .object({ share_cost_summary: z.boolean() })
  .strict();

/** Account-wide "don't track cost" choice, private to the owner. */
export const inventoryCostExclusionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  catalog_reference: catalogReferenceSchema.nullable(),
});
/** Account-wide "never track cost" choices for ingredients, not stock items. */
export const inventoryCostExclusionsResponseSchema = z.object({
  exclusions: z.array(inventoryCostExclusionSchema),
});
export const updateInventoryCostExclusionsRequestBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("exclude"),
    name: z.string().trim().min(1).max(200),
    catalog_reference: catalogReferenceSchema.nullable().default(null),
  }).strict(),
  z.object({ action: z.literal("include"), id: z.string().uuid() }).strict(),
]);

export const costQueryParamsSchema = z.object({
  public: z.enum(["true", "false"]).optional(),
});
export const brewCostPathParamsSchema = z.object({ brew_id: z.string().uuid() });
export const recipeCostPathParamsSchema = z.object({
  // Recipe IDs are Postgres INTEGER values; larger numbers are not found.
  id: z.string().regex(/^[1-9]\d{0,9}$/).refine((id) => Number(id) <= 2_147_483_647),
});
